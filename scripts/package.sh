#!/bin/bash
set -e

PACKAGED_NODE_VERSION="4.4.5"
NODE_VERSION=$( node --version )
COMMIT=$( node scripts/details.js COMMIT )
PACKAGE_VERSION=$( node scripts/details.js VERSION )
PACKAGE_NAME=$( node scripts/details.js NAME )
OS=$( node scripts/details.js OS )
PACKAGE_DIR=build/$PACKAGE_VERSION
DEEPSTREAM_PACKAGE=$PACKAGE_DIR/deepstream.io

EXTENSION=""
if [ $OS = "win32" ]; then
	EXTENSION=".exe"
fi

echo "Starting deepstream.io packaging"

if [ $NODE_VERSION != "v$PACKAGED_NODE_VERSION" ]; then
	echo "Packaging only done on $PACKAGED_NODE_VERSION"
	exit
fi

if [ $OS = "win32" ]; then
	echo "Downloading node src ( not via nexe )"
	mkdir -p nexe_node/node/$PACKAGED_NODE_VERSION
	cd nexe_node/node/$PACKAGED_NODE_VERSION

	curl -o node-$PACKAGED_NODE_VERSION.tar.gz https://nodejs.org/dist/v$PACKAGED_NODE_VERSION/node-v$PACKAGED_NODE_VERSION.tar.gz
	tar -xzf node-$PACKAGED_NODE_VERSION.tar.gz

	cd -

	cp scripts/resources/node.rc nexe_node/node/$PACKAGED_NODE_VERSION/node-v$PACKAGED_NODE_VERSION/src/res/node.rc
	cp scripts/resources/deepstream.ico nexe_node/node/$PACKAGED_NODE_VERSION/node-v$PACKAGED_NODE_VERSION/src/res/deepstream.ico
	sed -i "s/DEEPSTREAM_VERSION/$PACKAGE_VERSION/" nexe_node/node/$PACKAGED_NODE_VERSION/node-v$PACKAGED_NODE_VERSION/src/res/node.rc
fi

EXECUTABLE_NAME="build/deepstream$EXTENSION"

echo "Creating '$EXECUTABLE_NAME', this will take a while..."

./node_modules/.bin/nexe \
	--input "bin/deepstream" \
	--output $EXECUTABLE_NAME \
	--runtime $PACKAGED_NODE_VERSION \
	--temp "nexe_node" \
	--flags "--use_strict" \
	--framework "node"

echo "Packaging to dir structure at $DEEPSTREAM_PACKAGE"

rm -rf build/$PACKAGE_VERSION

mkdir -p $DEEPSTREAM_PACKAGE
mkdir $DEEPSTREAM_PACKAGE/var
mkdir $DEEPSTREAM_PACKAGE/lib
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
	echo "OS is linux, installing FPM"
	gem install fpm

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

	COMMIT_NAME="deepstream.io-linux-$PACKAGE_VERSION-$COMMIT.tar.gz"
	CLEAN_NAME="deepstream.io-linux-$PACKAGE_VERSION.tar.gz"

	echo "Creating tar.gz"
	cd $DEEPSTREAM_PACKAGE
	tar czf ../$COMMIT_NAME .
	cp ../$COMMIT_NAME ../../$CLEAN_NAME
	cd -
fi

rm -rf $DEEPSTREAM_PACKAGE
rm build/deepstream

echo "Files in build directory are $( ls build/ )"
echo "Done"