#!/bin/bash
set -e

PACKAGED_NODE_VERSION="v4.4.5"
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

if [ $NODE_VERSION != $PACKAGED_NODE_VERSION ]; then
	echo "Packaging only done on $PACKAGED_NODE_VERSION"
	exit
fi

EXECUTABLE_NAME="build/deepstream$EXTENSION"

echo "Creating '$EXECUTABLE_NAME', this will take a while..."

./node_modules/.bin/nexe \
	--input "start.js" \
	--output $EXECUTABLE_NAME \
	--runtime "4.4.5" \
	--temp "nexe_node" \
	--flags "--use_strict" \
	--framework "node" \
	> /dev/null

echo "Packaging to dir structure at $DEEPSTREAM_PACKAGE"

rm -rf build/$PACKAGE_VERSION

mkdir -p $DEEPSTREAM_PACKAGE
mkdir $DEEPSTREAM_PACKAGE/conf
mkdir $DEEPSTREAM_PACKAGE/var
mkdir $DEEPSTREAM_PACKAGE/lib

cp users.json $DEEPSTREAM_PACKAGE/conf/users.json
cp permissions.json $DEEPSTREAM_PACKAGE/conf/permissions.json
cp config.yml $DEEPSTREAM_PACKAGE/conf/config.yml
cp build/deepstream $DEEPSTREAM_PACKAGE/

if [ $OS = "win32" ]; then
	echo "OS is windows, hence creating zip deepstream.io-$PACKAGE_VERSION.zip"
	cd $DEEPSTREAM_PACKAGE
	7z a ../deepstream.io-$PACKAGE_VERSION-$COMMIT.zip . > /dev/null
	cp ../deepstream.io-$PACKAGE_VERSION-$COMMIT.zip ../../deepstream.io-$PACKAGE_VERSION.zip
	cd -
fi

if [ $OS = "darwin" ]; then
	echo "OS is mac, a work in progress"
fi

if [ $OS = "linux" ]; then
	echo "OS is linux, creating rpm and deb using FPM"
	gem install fpm

	fpm \
		-s dir \
		-t rpm \
		--package ./build/$PACKAGE_VERSION \
		--package-name-suffix $COMMIT \
		-n deepstream.io \
		-v $PACKAGE_VERSION \
		--license MIT \
		--vendor "deepstreamHub GmbH" \
		--description "deepstream.io rpm package" \
		--url https://deepstream.io/ \
		-m "<info@deepstream.io>" \
		--before-remove ./scripts/daemon/before-remove \
		--after-upgrade ./scripts/daemon/after-upgrade \
		-f \
		./config.yml=/etc/deepstream/config.yml \
		./permissions.json=/etc/deepstream/permissions.json \
		./users.json=/etc/deepstream/users.json \
		./build/deepstream=/usr/bin/deepstream \
		./scripts/daemon/init-script=/etc/init.d/deepstream

	fpm \
		-s dir \
		-t deb \
		--package ./build/$PACKAGE_VERSION \
		--package-name-suffix $COMMIT \
		-n deepstream.io \
		-v $PACKAGE_VERSION \
		--license MIT \
		--vendor "deepstreamHub GmbH" \
		--description "deepstream.io deb package" \
		--url https://deepstream.io/ \
		-m "<info@deepstream.io>" \
		--before-remove ./scripts/daemon/before-remove \
		--after-upgrade ./scripts/daemon/after-upgrade \
		-f \
		--deb-no-default-config-files \
		./config.yml=/etc/deepstream/config.yml \
		./permissions.json=/etc/deepstream/permissions.json \
		./users.json=/etc/deepstream/users.json \
		./build/deepstream=/usr/bin/deepstream \
		./scripts/daemon/init-script=/etc/init.d/deepstream
fi

rm -rf $DEEPSTREAM_PACKAGE
#rm build/deepstream

echo "Files in build directory are $( ls build/ )"
echo "Done"