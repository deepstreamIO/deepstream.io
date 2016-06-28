#!/bin/bash
set -e

LTS_VERSION="4"
NODE_VERSION=$( node --version )
NODE_VERSION_WITHOUT_V=$( echo $NODE_VERSION | cut -c2-10 )
COMMIT=$( node scripts/details.js COMMIT )
PACKAGE_VERSION=$( node scripts/details.js VERSION )
PACKAGE_NAME=$( node scripts/details.js NAME )
OS=$( node scripts/details.js OS )
PACKAGE_DIR=build/$PACKAGE_VERSION
DEEPSTREAM_PACKAGE=$PACKAGE_DIR/deepstream.io
GIT_BRANCH=$( git rev-parse --abbrev-ref HEAD )

NODE_SOURCE="nexe_node/node/$NODE_VERSION_WITHOUT_V/node-v$NODE_VERSION_WITHOUT_V"
NODE_DEPS="nexe_node/node/$NODE_VERSION_WITHOUT_V/node-v$NODE_VERSION_WITHOUT_V/deps"

EXTENSION=""
if [ $OS = "win32" ]; then
	EXTENSION=".exe"
fi
EXECUTABLE_NAME="build/deepstream$EXTENSION"

echo "Starting deepstream.io packaging with Node.js $NODE_VERSION_WITHOUT_V"
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

echo "Patching accepts dependency of engine.io (npm-shrinkwrap)"
rm -rf node_modules/engine.io
rm -f npm-shrinkwrap.json
npm install > /dev/null 2> /dev/null

npm shrinkwrap > /dev/null 2> /dev/null
node scripts/shrinkwrap.js
# Use versions that have been modified
rm -rf node_modules/engine.io
npm install > /dev/null 2> /dev/null

echo "Generating meta.json"
node scripts/details.js META

if [ $OS = "win32" ]; then

	echo "Downloading node src"
	mkdir -p nexe_node/node/$NODE_VERSION_WITHOUT_V
	cd nexe_node/node/$NODE_VERSION_WITHOUT_V
	curl -o node-$NODE_VERSION_WITHOUT_V.tar.gz https://nodejs.org/dist/v$NODE_VERSION_WITHOUT_V/node-v$NODE_VERSION_WITHOUT_V.tar.gz
	tar -xzf node-$NODE_VERSION_WITHOUT_V.tar.gz
	cd -

	NAME=$PACKAGE_VERSION

	echo "Patch the window executable icon and details"
	cp scripts/resources/node.rc $NODE_SOURCE/src/res/node.rc
	cp scripts/resources/deepstream.ico $NODE_SOURCE/src/res/deepstream.ico

	if ! [[ $PACKAGE_VERSION =~ ^[0-9]+[.][0-9]+[.][0-9]+$ ]]; then
		echo "Version can't contain characters in MSBuild, so replacing $PACKAGE_VERSION with 0.0.0"
		NAME="0.0.0"
	fi
	sed -i 's/DEEPSTREAM_VERSION/$NAME/' $NODE_SOURCE/src/res/node.rc
fi

# Nexe Patches
echo "Patching winston files for nexe/browserify"
cp scripts/patch-files/winston-transports.js node_modules/deepstream.io-logger-winston/node_modules/winston/lib/winston/transports.js
echo "module.exports = function() {}" > node_modules/deepstream.io-logger-winston/node_modules/winston/node_modules/pkginfo/lib/pkginfo.js

echo "Adding empty xml2js module for needle"
mkdir -p node_modules/xml2js && echo "module.exports = function() {}" >> node_modules/xml2js/index.js

if [ -d node_modules/bufferutil ]; then
	echo "Adding empty bufferutil module, since optional didn't install and isn't bundled anyway"
	mkdir -p node_modules/bufferutil && echo "module.exports = function() {}" >> node_modules/bufferutil/index.js
fi

if [ -d node_modules/utf-8-validate ]; then
	echo "Adding empty utf-8-validate module, since optional didn't install and isn't bundled anyway"
	mkdir -p node_modules/utf-8-validate && echo "module.exports = function() {}" >> node_modules/utf-8-validate/index.js
fi

# Creatine package structure
rm -rf build/$PACKAGE_VERSION
mkdir -p $DEEPSTREAM_PACKAGE
mkdir $DEEPSTREAM_PACKAGE/var
mkdir $DEEPSTREAM_PACKAGE/lib

if [ -d node_modules/uws ]; then
	echo "Adding uws as thirdparty library for performance improvements"
        mv -f node_modules/uws $DEEPSTREAM_PACKAGE/lib/uws
else
	echo "Adding empty uws module"
	mkdir -p node_modules/uws && echo "module.exports = function() {}" >> node_modules/uws/index.js
fi

echo "Creating '$EXECUTABLE_NAME', this will take a while..."

./node_modules/.bin/nexe \
	--input "bin/deepstream" \
	--output $EXECUTABLE_NAME \
	--runtime $NODE_VERSION_WITHOUT_V \
	--temp "nexe_node" \
	--flags "--use_strict" \
	--framework "node" \
	> /dev/null &

PROC_ID=$!
MINUTES=0;
while kill -0 "$PROC_ID" >/dev/null 2>&1; do
	echo "Compiling deepstream... ($MINUTES minutes)"
	sleep 60
	MINUTES=$[MINUTES+1]
done

if wait $pid; then
		echo "Nexe Build Succeeded"
else
		echo "Nexe Build Failed"
		exit 1
fi

echo "Moving deepstream into package structure at $DEEPSTREAM_PACKAGE"
cp -r conf $DEEPSTREAM_PACKAGE/
cp build/deepstream $DEEPSTREAM_PACKAGE/

if [ $OS = "win32" ]; then
	COMMIT_NAME="deepstream.io-windows-$PACKAGE_VERSION-$COMMIT.zip "
	CLEAN_NAME="deepstream.io-windows-$PACKAGE_VERSION.zip"

	echo "OS is windows, creating zip deepstream.io-windows-$PACKAGE_VERSION.zip"
	cd $DEEPSTREAM_PACKAGE
	7z a ../$COMMIT_NAME . > /dev/null
	cp ../$COMMIT_NAME ../../$CLEAN_NAME
	cd -
fi

if [ $OS = "darwin" ]; then
	COMMIT_NAME="deepstream.io-mac-$PACKAGE_VERSION-$COMMIT.zip"
	CLEAN_NAME="deepstream.io-mac-$PACKAGE_VERSION.zip"

	echo "OS is mac, creating $CLEAN_NAME"

	cd $DEEPSTREAM_PACKAGE
	zip -r ../$COMMIT_NAME .
	cp ../$COMMIT_NAME ../../$CLEAN_NAME
	cd -

	echo "Skipping .pkg creation"
	# gem install fpm
	# fpm \
	# 	-s dir \
	# 	-t osxpkg \
	# 	-v $PACKAGE_VERSION \
	# 	--package ./build/$PACKAGE_VERSION \
	# 	-n deepstream.io \
	# 	--license MIT \
	# 	--vendor "deepstreamHub GmbH" \
	# 	--url https://deepstream.io/ \
	# 	-m "<info@deepstream.io>" \
	# 	$DEEPSTREAM_PACKAGE
fi

if [ $OS = "linux" ]; then
	echo "OS is linux"


        echo "Creating tar.gz"

        COMMIT_NAME="deepstream.io-linux-$PACKAGE_VERSION-$COMMIT.tar.gz"
        CLEAN_NAME="deepstream.io-linux-$PACKAGE_VERSION.tar.gz"

        cd $DEEPSTREAM_PACKAGE
        tar czf ../$COMMIT_NAME .
        cp ../$COMMIT_NAME ../../$CLEAN_NAME
        cd -	

	echo "Installing FPM"
	gem install fpm > /dev/null

	echo "Creating rpm"
	fpm \
		-s dir \
		-t rpm \
		--package ./build/ \
		--package-name-suffix $COMMIT \
		-n deepstream.io \
		-v $PACKAGE_VERSION \
		--license "Apache 2" \
		--vendor "deepstreamHub GmbH" \
		--description "deepstream.io rpm package" \
		--url https://deepstream.io/ \
		-m "<info@deepstream.io>" \
		--after-install ./scripts/daemon/after-install \
		--before-remove ./scripts/daemon/before-remove \
		--after-upgrade ./scripts/daemon/after-upgrade \
		-f \
		./conf/config.yml=/etc/deepstream/config.yml \
		./conf/users.json=/etc/deepstream/users.json \
		./conf/permissions.json=/etc/deepstream/permissions.json \
		./build/deepstream=/usr/bin/deepstream \
		./scripts/daemon/init-script=/etc/init.d/deepstream

	echo "Creating deb"
	fpm \
		-s dir \
		-t deb \
		--package ./build \
		--package-name-suffix $COMMIT \
		-n deepstream.io \
		-v $PACKAGE_VERSION \
		--license "Apache 2" \
		--vendor "deepstreamHub GmbH" \
		--description "deepstream.io deb package" \
		--url https://deepstream.io/ \
		-m "<info@deepstream.io>" \
		--after-install ./scripts/daemon/after-install \
		--before-remove ./scripts/daemon/before-remove \
		--after-upgrade ./scripts/daemon/after-upgrade \
		-f \
		--deb-no-default-config-files \
		./conf/config.yml=/etc/deepstream/config.yml \
		./conf/users.json=/etc/deepstream/users.json \
		./conf/permissions.json=/etc/deepstream/permissions.json \
		./build/deepstream=/usr/bin/deepstream \
		./scripts/daemon/init-script=/etc/init.d/deepstream
fi

rm -rf $DEEPSTREAM_PACKAGE
rm build/deepstream

echo "Files in build directory are $( ls build/ )"
echo "Done"
rm -f npm-shrinkwrap
