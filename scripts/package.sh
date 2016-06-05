#!/bin/bash
PACKAGED_NODE_VERSION="v4.4.5"
NODE_VERSION=$( node --version )
COMMIT=$( node scripts/details.js COMMIT )
PACKAGE_VERSION=$( node scripts/details.js VERSION )
PACKAGE_NAME=$( node scripts/details.js NAME )
OS=$( node scripts/details.js OS )
PACKAGE_DIR=build/$PACKAGE_VERSION/$COMMIT
DEEPSTREAM_PACKAGE=$PACKAGE_DIR/deepstream.io

if [ $NODE_VERSION != $PACKAGED_NODE_VERSION ]; then
	echo Packaging only done on $PACKAGED_NODE_VERSION
	exit
fi

rm -rf build/$PACKAGE_VERSION

mkdir -p $DEEPSTREAM_PACKAGE
mkdir $DEEPSTREAM_PACKAGE/conf
mkdir $DEEPSTREAM_PACKAGE/var
mkdir $DEEPSTREAM_PACKAGE/lib

cp users.json $DEEPSTREAM_PACKAGE/conf/users.json
cp permissions.json $DEEPSTREAM_PACKAGE/conf/permissions.json
cp config.yml $DEEPSTREAM_PACKAGE/conf/config.yml
cp build/deepstream $DEEPSTREAM_PACKAGE/

if [ $OS = 'win32' ]; then
	cd $DEEPSTREAM_PACKAGE
	7z a ../deepstream.io-$PACKAGE_VERSION.zip .
fi

# if [ OS = 'darwin']; then
# 	echo 'Work in progress'
# fi

if [ $OS = 'linux' ]; then
	gem install fpm

	fpm \
		-s dir \
		-t rpm \
		--package ./build/$PACKAGE_VERSION/$COMMIT \
		-n deepstream.io \
		-v $PACKAGE_VERSION \
		--license MIT \
		--vendor 'deepstreamHub GmbH' \
		--description 'deepstream.io rpm package' \
		--url https://deepstream.io/ \
		-m '<info@deepstream.io>' \
		--before-remove ./scripts/daemon/before-remove \
		--after-upgrade ./scripts/daemon/after-upgrade \
		-f ./config.yml=/etc/deepstream/config.yml ./permissions.json=/etc/deepstream/permissions.json ./build/deepstream=/usr/bin/deepstream ./scripts/daemon/init-script=/etc/init.d/deepstream

	fpm \
		-s dir \
		-t deb \
		--package ./build/$PACKAGE_VERSION/$COMMIT \
		-n deepstream.io \
		-v $PACKAGE_VERSION \
		--license MIT \
		--vendor 'deepstreamHub GmbH' \
		--description 'deepstream.io deb package' \
		--url https://deepstream.io/ \
		-m '<info@deepstream.io>' \
		--before-remove ./scripts/daemon/before-remove \
		--after-upgrade ./scripts/daemon/after-upgrade \
		-f --deb-no-default-config-files ./config.yml=/etc/deepstream/config.yml ./permissions.json=/etc/deepstream/permissions.json ./build/deepstream=/usr/bin/deepstream ./scripts/daemon/init-script=/etc/init.d/deepstream
fi

rm -rf $DEEPSTREAM_PACKAGE
rm build/deepstream

echo Files in build directory are $( ls build/ )
echo 'Done'