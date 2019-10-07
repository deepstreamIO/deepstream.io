#!/bin/bash
set -e

PACKAGE_VERSION=$( node scripts/details.js VERSION )

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

npm i
npm run tsc
cd dist

docker build . -t deepstreamio/deepstream.io:${PACKAGE_VERSION} -t deepstreamio/deepstream.io:next
docker push deepstreamio/deepstream.io:${PACKAGE_VERSION}
docker push deepstreamio/deepstream.io:next

npm uninstall --save uWebSockets.js
echo 'Replacing node with node-alpine'
sed -i 's@node:10@node:10-alpine@' Dockerfile
echo 'Building node alpine'
docker build . -t deepstreamio/deepstream.io:${PACKAGE_VERSION}-alpine
echo 'Pushing node alpine'
docker push deepstreamio/deepstream.io:${PACKAGE_VERSION}-alpine

cd ../
