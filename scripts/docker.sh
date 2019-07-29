#!/bin/bash
set -e

PACKAGE_VERSION=$( node scripts/details.js VERSION )

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

npm i
npm run tsc
cd dist

docker build . -t deepstreamio/deepstream.io:${PACKAGE_VERSION} -t deepstreamio/deepstream.io:latest
docker push deepstreamio/deepstream.io:${PACKAGE_VERSION} deepstreamio/deepstream.io:latest

cd ../