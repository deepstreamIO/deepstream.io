#!/bin/bash
set -e

LTS_VERSION="6.11"
NODE_VERSION=$( node --version )
NODE_VERSION_WITHOUT_V=$( echo $NODE_VERSION | cut -c2-10 )
COMMIT=$( node scripts/details.js COMMIT )
PACKAGE_VERSION=$( node scripts/details.js VERSION )
UWS_COMMIT="193bd4744ebe0bca48b9f881f38792ded1235c40"
PACKAGE_NAME=$( node scripts/details.js NAME )
OS=$( node scripts/details.js OS )
PACKAGE_DIR=build/$PACKAGE_VERSION
DEEPSTREAM_PACKAGE=$PACKAGE_DIR/deepstream.io
GIT_BRANCH=$( git rev-parse --abbrev-ref HEAD )

NODE_SOURCE="nexe_node/node/$NODE_VERSION_WITHOUT_V/node-v$NODE_VERSION_WITHOUT_V"
UWS_SOURCE="nexe_node/uWebSockets/"

EXTENSION=""
if [ $OS = "win32" ]; then
    EXTENSION=".exe"
fi
EXECUTABLE_NAME="build/deepstream$EXTENSION"

# Needed even for void builds for travis deploy to pass
mkdir -p build

if ! [[ $NODE_VERSION_WITHOUT_V == $LTS_VERSION* ]]; then
    echo "Packaging only done on $LTS_VERSION.x"
    exit
fi

if [ -z $1  ]; then
    if ! [[ ${TRAVIS_BRANCH} = 'master' ]] && ! [[ ${APPVEYOR_REPO_BRANCH} = 'master' ]] && ! [[ ${GIT_BRANCH} = 'master' ]]; then
        echo "Running on branch ${GIT_BRANCH}"
        if [[ -z ${TRAVIS_TAG} ]] && [[ -z ${APPVEYOR_REPO_TAG} ]]; then
            echo "Only runs on tags or master"
            exit
        elif [[ ${APPVEYOR_REPO_TAG} = false ]]; then
            echo "On appveyor, not a tag or master"
            exit
        else
            echo "Running on tag ${TRAVIS_TAG} ${APPVEYOR_REPO_TAG}"
        fi
    else
        echo "Running on master"
    fi
fi

if [ $OS = "linux" ]; then
    echo "Checking if FPM is installed"
    fpm --version
fi

function compile {
    echo "Starting deepstream.io packaging with Node.js $NODE_VERSION_WITHOUT_V"
    rm -rf build
    mkdir build

    echo "Installing missing npm packages, just in case something changes"
    npm i

    echo -e "\tGenerate License File using unmodified npm packages"
    ./scripts/license-aggregator.js > build/DEPENDENCIES.LICENSE

    echo "Generating meta.json"
    node scripts/details.js META

    echo -e "Preparing node"
    mkdir -p nexe_node/node/$NODE_VERSION_WITHOUT_V
    cd nexe_node/node/$NODE_VERSION_WITHOUT_V
    rm -rf node-$NODE_VERSION_WITHOUT_V
    if [ ! -f node-$NODE_VERSION_WITHOUT_V.tar.gz ]; then
        echo -e "\tDownloading node src"
        curl -o node-$NODE_VERSION_WITHOUT_V.tar.gz https://nodejs.org/dist/v$NODE_VERSION_WITHOUT_V/node-v$NODE_VERSION_WITHOUT_V.tar.gz
    fi

    echo -e "\tUnpacking node"
    tar -xzf node-$NODE_VERSION_WITHOUT_V.tar.gz
    cd -

    echo -e "\t\tDelete node uws"
    rm -rf node_modules/uws

    echo -e "\tAdding in UWS"

    echo -e "\t\tDownloading UWS"
    rm -rf nexe_node/uWebSockets
    git clone https://github.com/uNetworking/bindings.git nexe_node/uWebSockets
    cd nexe_node/uWebSockets
    git checkout $UWS_COMMIT
    git submodule update --init
    cd -

    echo -e "\t\tAdding UWS into node"

    C_FILE_NAMES="      'src\/uws\/extension.cpp', 'src\/uws\/Extensions.cpp', 'src\/uws\/Group.cpp', 'src\/uws\/Networking.cpp', 'src\/uws\/Hub.cpp', 'src\/uws\/uws_Node.cpp', 'src\/uws\/WebSocket.cpp', 'src\/uws\/HTTPSocket.cpp', 'src\/uws\/Socket.cpp',"
    EXTRA_INCLUDES="        'src\/uws',"

    if [ $OS = "darwin" ]; then
        echo -e "\t\tapplying patches only tested on darwin node v6.9.1"
        sed -i '' "s@'library_files': \[@'library_files': \[ 'lib\/uws.js',@" $NODE_SOURCE/node.gyp
        sed -i '' "s@'src/debug-agent.cc',@'src\/debug-agent.cc',$C_FILE_NAMES@" $NODE_SOURCE/node.gyp
        sed -i '' "s@'CLANG_CXX_LANGUAGE_STANDARD': 'gnu++0x',  # -std=gnu++0x@'CLANG_CXX_LANGUAGE_STANDARD': 'gnu++0x', 'CLANG_CXX_LIBRARY': 'libc++',@" $NODE_SOURCE/common.gypi
        sed -i '' "14,18d" $NODE_SOURCE/src/util.h
    else
        sed -i "s/'library_files': \[/'library_files': \[\n      'lib\/uws.js',/" $NODE_SOURCE/node.gyp
        sed -i "s@'src/debug-agent.cc',@'src/debug-agent.cc',\n  $C_FILE_NAMES@" $NODE_SOURCE/node.gyp
        sed -i "s@'deps/uv/src/ares',@'deps/uv/src/ares',\n  $EXTRA_INCLUDES@" $NODE_SOURCE/node.gyp
        sed -i "s/'cflags': \[ '-g', '-O0' \],/'cflags': [ '-g', '-O0', '-DUSE_LIBUV' ],/" $NODE_SOURCE/common.gypi
        sed -i "s/} catch (e) {/} catch (e) { console.log( e );/" $UWS_SOURCE/nodejs/src/uws.js
    fi

    mkdir -p $NODE_SOURCE/src/uws
    cp $UWS_SOURCE/uWebSockets/src/* $NODE_SOURCE/src/uws
    mv $NODE_SOURCE/src/uws/Node.cpp $NODE_SOURCE/src/uws/uws_Node.cpp
    rm $NODE_SOURCE/src/uws/Epoll.h

    echo "#include \"Libuv.h\"" > $NODE_SOURCE/src/uws/Backend.h

    cp $UWS_SOURCE/nodejs/src/http.h $NODE_SOURCE/src/uws
    cp $UWS_SOURCE/nodejs/src/extension.cpp $NODE_SOURCE/src/uws
    cp $UWS_SOURCE/nodejs/src/addon.h $NODE_SOURCE/src/uws
    cp $UWS_SOURCE/nodejs/src/uws.js $NODE_SOURCE/lib/uws.js

    if [ $OS = "win32" ]; then
        echo "Windows icon"

        NAME=$PACKAGE_VERSION

        echo -e "\tPatch the window executable icon and details"
        cp scripts/resources/node.rc $NODE_SOURCE/src/res/node.rc
        cp scripts/resources/deepstream.ico $NODE_SOURCE/src/res/deepstream.ico

        if ! [[ $PACKAGE_VERSION =~ ^[0-9]+[.][0-9]+[.][0-9]+$ ]]; then
            echo -e "\tVersion can't contain characters in MSBuild, so replacing $PACKAGE_VERSION with 0.0.0"
            NAME="0.0.0"
        fi

        sed -i "s/DEEPSTREAM_VERSION/$NAME/" $NODE_SOURCE/src/res/node.rc
    fi

    # Nexe Patches
    echo "Nexe Patches for Browserify, copying stub versions of optional installs since they aern't bundled anyway"

    echo -e "\tStubbing xml2js for needle"
    mkdir -p node_modules/xml2js && echo "throw new Error()" >> node_modules/xml2js/index.js

    # Creatine package structure
    rm -rf build/$PACKAGE_VERSION
    mkdir -p $DEEPSTREAM_PACKAGE
    mkdir $DEEPSTREAM_PACKAGE/var
    mkdir $DEEPSTREAM_PACKAGE/lib
    mkdir $DEEPSTREAM_PACKAGE/doc

    echo "Adding winston logger to libs"
    cd $DEEPSTREAM_PACKAGE/lib
    echo '{ "name": "TEMP" }' > package.json
    npm install deepstream.io-logger-winston --loglevel error
    mv -f node_modules/deepstream.io-logger-winston ./deepstream.io-logger-winston
    rm -rf node_modules package.json
    cd -

    cd $DEEPSTREAM_PACKAGE/lib/deepstream.io-logger-winston
    npm install --production --loglevel error
    cd -

    echo "Creating '$EXECUTABLE_NAME', this will take a while..."
    NODE_VERSION_WITHOUT_V=$NODE_VERSION_WITHOUT_V EXECUTABLE_NAME=$EXECUTABLE_NAME node scripts/nexe.js > /dev/null &

    PROC_ID=$!
    SECONDS=0;
    while kill -0 "$PROC_ID" >/dev/null 2>&1; do
        echo -ne "\rCompiling deepstream... ($SECONDS SECONDS)"
        sleep 1
    done

    echo ""

    if wait $pid; then
        echo -e "\tNexe Build Succeeded"
    else
        echo -e "\tNexe Build Failed"
        exit 1
    fi

    echo "Adding docs"
    echo -e "\tAdding Readme"
    echo "Documentation is available at https://deepstreamhub.com/open-source
    " > $DEEPSTREAM_PACKAGE/doc/README
    echo -e "\tAdding Changelog"
    cp CHANGELOG.md $DEEPSTREAM_PACKAGE/doc/CHANGELOG.md
    echo -e "\tAdding Licenses"
    cp $NODE_SOURCE/LICENSE $DEEPSTREAM_PACKAGE/doc/NODE.LICENSE
    mv build/DEPENDENCIES.LICENSE $DEEPSTREAM_PACKAGE/doc/LICENSE

    echo "Moving deepstream into package structure at $DEEPSTREAM_PACKAGE"
    cp -r conf $DEEPSTREAM_PACKAGE/
    cp build/deepstream $DEEPSTREAM_PACKAGE/

    echo "Patching config file for zip lib and var directories"
    cp -f ./scripts/package-conf.yml $DEEPSTREAM_PACKAGE/conf/config.yml
}

function windows {
    COMMIT_NAME="deepstream.io-windows-$PACKAGE_VERSION-$COMMIT.zip "
    CLEAN_NAME="deepstream.io-windows-$PACKAGE_VERSION.zip"

    echo "OS is windows"
    echo -e "\tCreating zip deepstream.io-windows-$PACKAGE_VERSION.zip"
    cd $DEEPSTREAM_PACKAGE
    7z a ../$COMMIT_NAME . > /dev/null
    cp ../$COMMIT_NAME ../../$CLEAN_NAME
    cd -
}

function mac {
    COMMIT_NAME="deepstream.io-mac-$PACKAGE_VERSION-$COMMIT"
    CLEAN_NAME="deepstream.io-mac-$PACKAGE_VERSION"

    echo "OS is mac"
    echo -e "\tCreating $CLEAN_NAME"

    cd $DEEPSTREAM_PACKAGE
    zip -r ../${COMMIT_NAME}.zip .
    cp ../${COMMIT_NAME}.zip ../../${CLEAN_NAME}.zip
    cd -

    rm -rf build/osxpkg
    mkdir -p build/osxpkg/bin
    mkdir -p build/osxpkg/etc/deepstream
    mkdir -p build/osxpkg/lib/deepstream
    mkdir -p build/osxpkg/share/doc/deepstream
    mkdir -p build/osxpkg/var/log/deepstream

    cp -r ${DEEPSTREAM_PACKAGE}/deepstream build/osxpkg/bin/deepstream
    cp -r ${DEEPSTREAM_PACKAGE}/conf/* build/osxpkg/etc/deepstream
    cp -r ${DEEPSTREAM_PACKAGE}/lib/* build/osxpkg/lib/deepstream
    cp -r ${DEEPSTREAM_PACKAGE}/doc/* build/osxpkg/share/doc/deepstream

    echo "Patching config file for lib and var directories"
    sed -i '' 's@ ../lib@ /usr/local/lib/deepstream@' build/osxpkg/etc/deepstream/config.yml
    sed -i '' 's@ ../var@ /usr/local/var/log/deepstream@' build/osxpkg/etc/deepstream/config.yml

    cp build/osxpkg/etc/deepstream/config.yml build/osxpkg/etc/deepstream/config.defaults

    chmod -R 777 build/osxpkg/bin
    chmod -R 777 build/osxpkg/share
    chmod -R 777 build/osxpkg/var
    chmod -R 777 build/osxpkg/lib
    chmod -R 777 build/osxpkg/etc

    echo "\tCreating *.pkg"
    pkgbuild \
        --root build/osxpkg \
        --identifier deepstream.io \
        --version $PACKAGE_VERSION \
        --info scripts/PackageInfo \
        --install-location /usr/local \
        ${DEEPSTREAM_PACKAGE}/../${COMMIT_NAME}.pkg

    cp \
      ${DEEPSTREAM_PACKAGE}/../${COMMIT_NAME}.pkg \
      ${DEEPSTREAM_PACKAGE}/../../${CLEAN_NAME}.pkg

    rm -rf build/osxpkg
}

function linux {
    echo "OS is linux"

    echo -e "\tCreating tar.gz"

    COMMIT_NAME="deepstream.io-linux-$PACKAGE_VERSION-$COMMIT.tar.gz"
    CLEAN_NAME="deepstream.io-linux-$PACKAGE_VERSION.tar.gz"

    cd $DEEPSTREAM_PACKAGE
    tar czf ../$COMMIT_NAME .
    cp ../$COMMIT_NAME ../../$CLEAN_NAME
    cd -

    echo -e "\tPatching config file for linux distros..."

    if [ $OS = "darwin" ]; then
        sed -i '' 's@ ../lib@ /var/lib/deepstream@' $DEEPSTREAM_PACKAGE/conf/config.yml
        sed -i '' 's@ ../var@ /var/log/deepstream@' $DEEPSTREAM_PACKAGE/conf/config.yml
    else
        sed -i 's@ ../lib@ /var/lib/deepstream@' $DEEPSTREAM_PACKAGE/conf/config.yml
        sed -i 's@ ../var@ /var/log/deepstream@' $DEEPSTREAM_PACKAGE/conf/config.yml
    fi

    echo -e "\t\tCreating rpm"

    fpm \
        -s dir \
        -t rpm \
        --package ./build/ \
        --package-name-suffix $COMMIT \
        -n deepstream.io \
        -v $PACKAGE_VERSION \
        --license "AGPL-3.0" \
        --vendor "deepstreamHub GmbH" \
        --description "deepstream.io rpm package" \
        --url https://deepstream.io/ \
        -m "<info@deepstreamhub.com>" \
        --after-install ./scripts/daemon/after-install \
        --before-remove ./scripts/daemon/before-remove \
        --before-upgrade ./scripts/daemon/before-upgrade \
        --after-upgrade ./scripts/daemon/after-upgrade \
        -f \
        $DEEPSTREAM_PACKAGE/doc/=/usr/share/doc/deepstream/ \
        $DEEPSTREAM_PACKAGE/conf/=/etc/deepstream/conf.d/ \
        $DEEPSTREAM_PACKAGE/lib/=/var/lib/deepstream/ \
        ./build/deepstream=/usr/bin/deepstream

    echo -e "\t\tCreating deb"
    fpm \
        -s dir \
        -t deb \
        --package ./build \
        --package-name-suffix $COMMIT \
        -n deepstream.io \
        -v $PACKAGE_VERSION \
        --license "AGPL-3.0" \
        --vendor "deepstreamHub GmbH" \
        --description "deepstream.io deb package" \
        --url https://deepstream.io/ \
        -m "<info@deepstreamhub.com>" \
        --after-install ./scripts/daemon/after-install \
        --before-remove ./scripts/daemon/before-remove \
        --before-upgrade ./scripts/daemon/before-upgrade \
        --after-upgrade ./scripts/daemon/after-upgrade \
        -f \
        --deb-no-default-config-files \
        $DEEPSTREAM_PACKAGE/doc/=/usr/share/doc/deepstream/ \
        $DEEPSTREAM_PACKAGE/conf/=/etc/deepstream/conf.d/ \
        $DEEPSTREAM_PACKAGE/lib/=/var/lib/deepstream/ \
        ./build/deepstream=/usr/bin/deepstream
}

function clean {
    rm -rf $DEEPSTREAM_PACKAGE
    rm build/deepstream
    rm -f npm-shrinkwrap
}

compile

if [ $OS = "win32" ]; then
    windows
elif [ $OS = "darwin" ]; then
    mac
elif [ $OS = "linux" ]; then
    linux
fi

clean

echo "Files in build directory are $( ls build/ )"
echo "Done"
