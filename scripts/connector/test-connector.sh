#!/bin/bash
set -e

curl -o deepstream_package.json https://raw.githubusercontent.com/deepstreamIO/deepstream.io/master/package.json
DEEPSTREAM_VERSION="$( cat deepstream_package.json | grep version | awk '{ print $2 }' | sed s/\"//g | sed s/,//g )"

NODE_VERSION=$( node --version )
OS=$( node -e "console.log(require('os').platform())" )
PACKAGE_VERSION=$( cat package.json | grep version | awk '{ print $2 }' | sed s/\"//g | sed s/,//g )
PACKAGE_NAME=$( cat package.json | grep name | awk '{ print $2 }' | sed s/\"//g | sed s/,//g )
TYPE=$( node -e "console.log(process.argv[1].match('@deepstream/(.*)-(.*)')[1])" $PACKAGE_NAME )
CONNECTOR=$( node -e "console.log(process.argv[1].match('@deepstream/(.*)-(.*)')[2])" $PACKAGE_NAME )

rm -rf build
mkdir build
cd build

if [ -z $1 ]; then
	if [[ -z ${TRAVIS_TAG} ]] && [[ -z ${APPVEYOR_REPO_TAG} ]]; then
		echo "Only runs on tags"
		exit
	elif [[ ${APPVEYOR_REPO_TAG} = false ]]; then
		echo "On appveyor, not a tag"
		exit
	else
		echo "Running on tag ${TRAVIS_TAG} ${APPVEYOR_REPO_TAG}"
	fi
else
	echo "Build forced although not tag"
fi

echo "Starting deepstream.io $TYPE $CONNECTOR $PACKAGE_VERSION test for $DEEPSTREAM_VERSION on $OS"

echo "Downloading deepstream $DEEPSTREAM_VERSION"
if [ $OS = "win32" ]; then
	DEEPSTREAM=deepstream.io-windows-${DEEPSTREAM_VERSION}
	curl -o ${DEEPSTREAM}.zip -L https://github.com/deepstreamIO/deepstream.io/releases/download/v${DEEPSTREAM_VERSION}/${DEEPSTREAM}.zip
	7z x ${DEEPSTREAM}.zip -o${DEEPSTREAM}
elif [ $OS == 'darwin' ]; then
	DEEPSTREAM=deepstream.io-mac-${DEEPSTREAM_VERSION}
	curl -o ${DEEPSTREAM}.zip -L https://github.com/deepstreamIO/deepstream.io/releases/download/v${DEEPSTREAM_VERSION}/${DEEPSTREAM}.zip
	unzip ${DEEPSTREAM} -d ${DEEPSTREAM}
else
	DEEPSTREAM=deepstream.io-linux-${DEEPSTREAM_VERSION}
	mkdir -p ${DEEPSTREAM}
	curl -o ${DEEPSTREAM}.tar.gz -L https://github.com/deepstreamIO/deepstream.io/releases/download/v${DEEPSTREAM_VERSION}/${DEEPSTREAM}.tar.gz
	tar -xzf ${DEEPSTREAM}.tar.gz -C ${DEEPSTREAM}
fi

cd ${DEEPSTREAM}
chmod 555 deepstream
echo "./deepstream --version"
./deepstream --version
echo "./deepstream install $TYPE $CONNECTOR:$PACKAGE_VERSION"
./deepstream install $TYPE $CONNECTOR:$PACKAGE_VERSION --verbose
./deepstream start -c ../../example-config.yml &

PROC_ID=$!

sleep 10

if ! [ kill -0 "$PROC_ID" > /dev/null 2>&1 ]; then
	echo "Deepstream is not running after the first ten seconds"
	exit 1
fi

# Rest comes on beta.5
