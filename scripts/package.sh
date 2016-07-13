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

if [ $OS = "linux" ]; then
	echo "Checking if FPM is installed"
	fpm --version
fi

echo "Patching accepts dependency of engine.io (npm-shrinkwrap)"
rm -rf node_modules/engine.io
rm -f npm-shrinkwrap.json
npm install --loglevel error

echo -e "\tGenerate License File using unmodified npm packages"
./scripts/license-aggregator.js > build/DEPENDENCIES.LICENSE

npm shrinkwrap --loglevel error
node scripts/shrinkwrap.js
# Use versions that have been modified
rm -rf node_modules/engine.io
npm install --loglevel error

echo "Generating meta.json"
node scripts/details.js META

if [ $OS = "win32" ]; then
	echo "Windows icon"

	echo -e "\tDownloading node src"
	mkdir -p nexe_node/node/$NODE_VERSION_WITHOUT_V
	cd nexe_node/node/$NODE_VERSION_WITHOUT_V
	curl -o node-$NODE_VERSION_WITHOUT_V.tar.gz https://nodejs.org/dist/v$NODE_VERSION_WITHOUT_V/node-v$NODE_VERSION_WITHOUT_V.tar.gz
	tar -xzf node-$NODE_VERSION_WITHOUT_V.tar.gz
	cd -

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

echo -e "\tStubbing bufferutil"
rm -rf node_modules/bufferutil
mkdir -p node_modules/bufferutil && echo "throw new Error()" >> node_modules/bufferutil/index.js

echo -e "\tStubbing utf-8-validate"
rm -rf node_modules/utf-8-validate
mkdir -p node_modules/utf-8-validate && echo "throw new Error()" >> node_modules/utf-8-validate/index.js

# Creatine package structure
rm -rf build/$PACKAGE_VERSION
mkdir -p $DEEPSTREAM_PACKAGE
mkdir $DEEPSTREAM_PACKAGE/var
mkdir $DEEPSTREAM_PACKAGE/lib
mkdir $DEEPSTREAM_PACKAGE/doc

if [ -d node_modules/uws ]; then
	echo "Adding uws as thirdparty library for performance improvements"
	cp -rf node_modules/uws $DEEPSTREAM_PACKAGE/lib/uws
else
	echo -e "\tAdding empty uws module"
	mkdir -p node_modules/uws && echo "module.exports = function() {}" >> node_modules/uws/index.js
fi

echo "Adding winston logger to libs"
cd $DEEPSTREAM_PACKAGE/lib
echo '{ "name": "TEMP" }' > package.json
npm install deepstream.io-logger-winston --loglevel error
mv -f node_modules/deepstream.io-logger-winston ./deepstream.io-logger-winston
rm -rf node_modules package.json
cd -

echo "Creating '$EXECUTABLE_NAME', this will take a while..."
NODE_VERSION_WITHOUT_V=$NODE_VERSION_WITHOUT_V EXECUTABLE_NAME=$EXECUTABLE_NAME node scripts/nexe.js > /dev/null &

PROC_ID=$!
SECONDS=0;
while kill -0 "$PROC_ID" >/dev/null 2>&1; do
	echo -ne "\rCompiling deepstream... ($SECONDS SECONDS)"
	sleep 1
	SECONDS=$[SECONDS+1]
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
echo "Documentation is available at https://deepstream.io
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

if [ $OS = "win32" ]; then
	COMMIT_NAME="deepstream.io-windows-$PACKAGE_VERSION-$COMMIT.zip "
	CLEAN_NAME="deepstream.io-windows-$PACKAGE_VERSION.zip"

	echo "OS is windows"
	echo -e "\tCreating zip deepstream.io-windows-$PACKAGE_VERSION.zip"
	cd $DEEPSTREAM_PACKAGE
	7z a ../$COMMIT_NAME . > /dev/null
	cp ../$COMMIT_NAME ../../$CLEAN_NAME
	cd -
fi

if [ $OS = "darwin" ]; then
	COMMIT_NAME="deepstream.io-mac-$PACKAGE_VERSION-$COMMIT.zip"
	CLEAN_NAME="deepstream.io-mac-$PACKAGE_VERSION.zip"

	echo "OS is mac"
	echo -e "\tCreating $CLEAN_NAME"

	cd $DEEPSTREAM_PACKAGE
	zip -r ../$COMMIT_NAME .
	cp ../$COMMIT_NAME ../../$CLEAN_NAME
	cd -

	echo -e "\tSkipping .pkg creation"
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
		-m "<info@deepstream.io>" \
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
		-m "<info@deepstream.io>" \
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
fi

rm -rf $DEEPSTREAM_PACKAGE
rm build/deepstream

echo "Files in build directory are $( ls build/ )"
echo "Done"
rm -f npm-shrinkwrap
