#!/bin/bash
set -e

LTS_VERSION="10"
NODE_VERSION=$( node --version )
NODE_VERSION_WITHOUT_V=$( echo ${NODE_VERSION} | cut -c2-10 )
COMMIT=$( node scripts/details.js COMMIT )
PACKAGE_VERSION=$( node scripts/details.js VERSION )
PACKAGE_NAME=$( node scripts/details.js NAME )
OS=$( node scripts/details.js OS )
PACKAGE_DIR=build/${PACKAGE_VERSION}
DEEPSTREAM_PACKAGE=${PACKAGE_DIR}/deepstream.io
GIT_BRANCH=$( git rev-parse --abbrev-ref HEAD )
CREATE_DISTROS=false

NODE_SOURCE="nexe_node/node/$NODE_VERSION_WITHOUT_V/node-v$NODE_VERSION_WITHOUT_V"

EXTENSION=""
if [[ ${OS} = "win32" ]]; then
    EXTENSION=".exe"
fi
EXECUTABLE_NAME="build/deepstream$EXTENSION"

# Needed even for void builds for travis deploy to pass
mkdir -p build

if ! [[ ${NODE_VERSION_WITHOUT_V} == ${LTS_VERSION}* ]]; then
    echo "Packaging only done on $LTS_VERSION.x"
    exit
fi

if [[ -z $1  ]]; then
    if ! [[ ${TRAVIS_BRANCH} = 'master' ]] && ! [[ ${APPVEYOR_REPO_BRANCH} = 'master' ]] && ! [[ ${GIT_BRANCH} = 'master' ]]; then
        echo "Running on branch ${GIT_BRANCH}"
        if [[ -z ${TRAVIS_TAG} ]] && [[ -z ${APPVEYOR_REPO_TAG} ]]; then
            echo "Only runs on tags or master"
            exit
        elif [[ ${APPVEYOR_REPO_TAG} = false ]]; then
            echo "On appveyor, not a tag or master"
            exit
        else
            echo "Running on tag $TRAVIS_TAG $APPVEYOR_REPO_TAG"
        fi
    else
        echo "Running on master"
    fi
fi

if [[ $2 ]]; then
    echo 'Ignoring distros'
elif [[ ${OS} = "linux" ]]; then
    CREATE_DISTROS=true
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

    # Nexe Patches
    echo "Nexe Patches for Browserify, copying stub versions of optional installs since they aern't bundled anyway"

    echo -e "\tStubbing xml2js for needle"
    mkdir -p node_modules/xml2js && echo "throw new Error()" >> node_modules/xml2js/index.js

    # Creating package structure
    rm -rf build/${PACKAGE_VERSION}
    mkdir -p ${DEEPSTREAM_PACKAGE}
    mkdir ${DEEPSTREAM_PACKAGE}/var
    mkdir ${DEEPSTREAM_PACKAGE}/lib
    mkdir ${DEEPSTREAM_PACKAGE}/doc

    echo "Adding uWebSockets.js to libs"
    cd ${DEEPSTREAM_PACKAGE}/lib
    echo '{ "name": "TEMP" }' > package.json
    npm install uWebSockets.js@github:uNetworking/uWebSockets.js#binaries
    mv -f node_modules/uWebSockets.js ./uWebSockets.js
    rm -rf node_modules package.json
    cd -

    echo "Creating '$EXECUTABLE_NAME', this will take a while..."
    NODE_VERSION_WITHOUT_V=${NODE_VERSION_WITHOUT_V} EXECUTABLE_NAME=${EXECUTABLE_NAME} node scripts/nexe.js > /dev/null &

    PROC_ID=$!
    SECONDS=0;
    while kill -0 "$PROC_ID" >/dev/null 2>&1; do
        echo -ne "\rCompiling deepstream... ($SECONDS)"
        sleep 10
    done

    echo ""

    if wait ${pid}; then
        echo -e "\tNexe Build Succeeded"
    else
        echo -e "\tNexe Build Failed"
        exit 1
    fi

    echo "Adding docs"
    echo -e "\tAdding Readme"
    echo "Documentation is available at https://deepstreamhub.com/open-source
    " > ${DEEPSTREAM_PACKAGE}/doc/README
    echo -e "\tAdding Changelog"
    cp CHANGELOG.md ${DEEPSTREAM_PACKAGE}/doc/CHANGELOG.md
    echo -e "\tAdding Licenses"
    curl -L https://raw.githubusercontent.com/nodejs/node/v10.x/LICENSE -o ${DEEPSTREAM_PACKAGE}/doc/NODE.LICENSE
    mv build/DEPENDENCIES.LICENSE ${DEEPSTREAM_PACKAGE}/doc/LICENSE

    echo "Moving deepstream into package structure at $DEEPSTREAM_PACKAGE"
    cp -r conf ${DEEPSTREAM_PACKAGE}/
    cp build/deepstream ${DEEPSTREAM_PACKAGE}/

    echo "Patching config file for zip lib and var directories"
    cp -f ./scripts/resources/package-conf.yml ${DEEPSTREAM_PACKAGE}/conf/config.yml
}

function windows {
    COMMIT_NAME="deepstream.io-windows-$PACKAGE_VERSION-$COMMIT.zip "
    CLEAN_NAME="deepstream.io-windows-$PACKAGE_VERSION.zip"

    echo "OS is windows"
    echo -e "\tCreating zip deepstream.io-windows-$PACKAGE_VERSION.zip"
    cd ${DEEPSTREAM_PACKAGE}
    7z a ../${COMMIT_NAME} . > /dev/null
    cp ../${COMMIT_NAME} ../../${CLEAN_NAME}
    cd -
}

function mac {
    COMMIT_NAME="deepstream.io-mac-${PACKAGE_VERSION}-${COMMIT}"
    CLEAN_NAME="deepstream.io-mac-${PACKAGE_VERSION}"

    echo "OS is mac"
    echo -e "\tCreating ${CLEAN_NAME}"

    cd ${DEEPSTREAM_PACKAGE}
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
        --version ${PACKAGE_VERSION} \
        --info scripts/resources/PackageInfo \
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

    COMMIT_NAME="deepstream.io-linux-${PACKAGE_VERSION}-${COMMIT}.tar.gz"
    CLEAN_NAME="deepstream.io-linux-${PACKAGE_VERSION}.tar.gz"

    cd ${DEEPSTREAM_PACKAGE}
    tar czf ../${COMMIT_NAME} .
    cp ../${COMMIT_NAME} ../../${CLEAN_NAME}
    cd -
}

function distros {
    echo -e "\tPatching config file for linux distros..."

    if [[ ${OS} = "darwin" ]]; then
        sed -i '' 's@ ../lib@ /var/lib/deepstream@' ${DEEPSTREAM_PACKAGE}/conf/config.yml
        sed -i '' 's@ ../var@ /var/log/deepstream@' ${DEEPSTREAM_PACKAGE}/conf/config.yml
    else
        sed -i 's@ ../lib@ /var/lib/deepstream@' ${DEEPSTREAM_PACKAGE}/conf/config.yml
        sed -i 's@ ../var@ /var/log/deepstream@' ${DEEPSTREAM_PACKAGE}/conf/config.yml
    fi

    echo -e "\t\tCreating rpm"

    fpm \
        -s dir \
        -t rpm \
        --package ./build/ \
        --package-name-suffix ${COMMIT} \
        -n deepstream.io \
        -v ${PACKAGE_VERSION} \
        --license "AGPL-3.0" \
        --vendor "deepstreamHub GmbH" \
        --description "deepstream.io rpm package" \
        --url https://deepstream.io/ \
        -m "<info@deepstreamhub.com>" \
        --after-install ./scripts/resources/daemon/after-install \
        --before-remove ./scripts/resources/daemon/before-remove \
        --before-upgrade ./scripts/resources/daemon/before-upgrade \
        --after-upgrade ./scripts/resources/daemon/after-upgrade \
        -f \
        ${DEEPSTREAM_PACKAGE}/doc/=/usr/share/doc/deepstream/ \
        ${DEEPSTREAM_PACKAGE}/conf/=/etc/deepstream/conf.d/ \
        ${DEEPSTREAM_PACKAGE}/lib/=/var/lib/deepstream/ \
        ./build/deepstream=/usr/bin/deepstream

    echo -e "\t\tCreating deb"
    fpm \
        -s dir \
        -t deb \
        --package ./build \
        --package-name-suffix ${COMMIT} \
        -n deepstream.io \
        -v ${PACKAGE_VERSION} \
        --license "AGPL-3.0" \
        --vendor "deepstreamHub GmbH" \
        --description "deepstream.io deb package" \
        --url https://deepstream.io/ \
        -m "<info@deepstreamhub.com>" \
        --after-install ./scripts/resources/daemon/after-install \
        --before-remove ./scripts/resources/daemon/before-remove \
        --before-upgrade ./scripts/resources/daemon/before-upgrade \
        --after-upgrade ./scripts/resources/daemon/after-upgrade \
        -f \
        --deb-no-default-config-files \
        ${DEEPSTREAM_PACKAGE}/doc/=/usr/share/doc/deepstream/ \
        ${DEEPSTREAM_PACKAGE}/conf/=/etc/deepstream/conf.d/ \
        ${DEEPSTREAM_PACKAGE}/lib/=/var/lib/deepstream/ \
        ./build/deepstream=/usr/bin/deepstream
}

function clean {
    rm -rf ${DEEPSTREAM_PACKAGE}
    rm build/deepstream
    rm -f npm-shrinkwrap
}

compile

if [[ $OS = "win32" ]]; then
    windows
elif [[ ${OS} = "darwin" ]]; then
    mac
elif [[ ${OS} = "linux" ]]; then
    linux
    if [[ ${CREATE_DISTROS} = true ]]; then
        distros
    fi
fi

clean

echo "Files in build directory are $( ls build/ )"
echo "Done"
