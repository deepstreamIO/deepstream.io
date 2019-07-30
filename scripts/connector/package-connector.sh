#!/bin/bash
PACKAGED_NODE_VERSION="v10"
OS=$( node -e "console.log(require('os').platform())" )
NODE_VERSION=$( node --version )
COMMIT=$( git log --pretty=format:%h -n 1 )
PACKAGE_VERSION=$( cat package.json | grep version | awk '{ print $2 }' | sed s/\"//g | sed s/,//g )
PACKAGE_NAME=$( cat package.json | grep name | awk '{ print $2 }' | sed s/\"//g | sed s/,//g )
PACKAGE_NAME=$( node -e "console.log(process.argv[1].replace('@deepstream/', 'deepstream.io-'))" $PACKAGE_NAME )

# These must happen before any exits otherwise deployment would fail
# Clean the build directory
rm -rf build
mkdir -p build/$PACKAGE_VERSION

if ! [[ $NODE_VERSION == $PACKAGED_NODE_VERSION* ]]; then
	echo "Packaging only done on $PACKAGED_NODE_VERSION.x"
	exit
fi

if [ $OS == "darwin" ]; then
	PLATFORM="mac"
elif  [ $OS == "linux" ]; then
	PLATFORM="linux"
elif  [ $OS == "win32" ]; then
	PLATFORM="windows"
else
	echo "Operating system $OS not supported for packaging"
	exit
fi

FILE_NAME=$PACKAGE_NAME-$PLATFORM-$PACKAGE_VERSION-$COMMIT

# Do a git archive and a production install
# to have cleanest output
git archive --format=zip $COMMIT -o ./build/$PACKAGE_VERSION/temp.zip
cd ./build/$PACKAGE_VERSION
unzip temp.zip -d $PACKAGE_NAME

cd $PACKAGE_NAME
npm install --production
echo 'Installed NPM Dependencies'

if [ $PLATFORM == 'mac' ]; then
	FILE_NAME="$FILE_NAME.zip"
	CLEAN_FILE_NAME="$PACKAGE_NAME-$PLATFORM.zip"
	zip -r ../$FILE_NAME .
elif [ $PLATFORM == 'windows' ]; then
	FILE_NAME="$FILE_NAME.zip"
	CLEAN_FILE_NAME="$PACKAGE_NAME-$PLATFORM.zip"
	7z a ../$FILE_NAME .
else
	FILE_NAME="$FILE_NAME.tar.gz"
	CLEAN_FILE_NAME="$PACKAGE_NAME-$PLATFORM.tar.gz"
	tar czf ../$FILE_NAME .
fi

cd ..
rm -rf $PACKAGE_NAME temp.zip

cp $FILE_NAME ../$CLEAN_FILE_NAME
echo 'Done'
