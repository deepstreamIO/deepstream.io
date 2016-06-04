#!/bin/bash
PACKAGED_NODE_VERSION="v4.4.5"
NODE_VERSION=$( node --version )
COMMIT=$( node scripts/details.js COMMIT )
PACKAGE_VERSION=$( node scripts/details.js VERSION )
PACKAGE_NAME=$( node scripts/details.js NAME )
OS=$( node scripts/details.js OS )
DEEPSTREAM_PACKAGE=build/$PACKAGE_VERSION/deepstream.io

if [ $NODE_VERSION != $PACKAGED_NODE_VERSION ]; then
	echo Packaging only done on $PACKAGED_NODE_VERSION
	exit
fi

rm -rf build/$PACKAGE_VERSION

mkdir build/$PACKAGE_VERSION
mkdir $DEEPSTREAM_PACKAGE
mkdir $DEEPSTREAM_PACKAGE/conf
mkdir $DEEPSTREAM_PACKAGE/var
mkdir $DEEPSTREAM_PACKAGE/lib

cp users.json $DEEPSTREAM_PACKAGE/conf/users.json
cp permissions.json $DEEPSTREAM_PACKAGE/conf/permissions.json
cp config.yml $DEEPSTREAM_PACKAGE/conf/config.yml
cp build/deepstream $DEEPSTREAM_PACKAGE/

echo 'Done'