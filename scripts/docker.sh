#!/bin/bash
set -e

PACKAGE_VERSION=$( node scripts/details.js VERSION )

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

npm i
npm run tsc
cd dist

docker build . -t deepstreamio/deepstream.io:${PACKAGE_VERSION} -t deepstreamio/deepstream.io:latest
docker push deepstreamio/deepstream.io:${PACKAGE_VERSION}
docker push deepstreamio/deepstream.io:latest

npm uninstall --save uWebSockets.js
echo 'Replacing node with node-alpine'
sed -i 's@node:12@node:12-alpine@' Dockerfile
echo 'Building node alpine'
docker build . -t deepstreamio/deepstream.io:${PACKAGE_VERSION}-alpine -t deepstreamio/deepstream.io:latest-alpine
echo 'Pushing node alpine'
docker push deepstreamio/deepstream.io:${PACKAGE_VERSION}-alpine deepstreamio/deepstream.io:latest-alpine

cd ../
