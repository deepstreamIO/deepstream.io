## deepstream.io: The Open Realtime Server
----------------------------------------------
deepstream is a new type of server that syncs data and sends events across millions of clients

[![Build Status](https://travis-ci.org/deepstreamIO/deepstream.io.svg?branch=master)](https://travis-ci.org/deepstreamIO/deepstream.io) [![npm version](https://badge.fury.io/js/deepstream.io.svg)](http://badge.fury.io/js/deepstream.io) [![Coverage Status](https://coveralls.io/repos/github/deepstreamIO/deepstream.io/badge.svg?branch=master)](https://coveralls.io/github/deepstreamIO/deepstream.io?branch=master) [![dependencies Status](https://david-dm.org/deepstreamIO/deepstream.io/status.svg)](https://david-dm.org/deepstreamIO/deepstream.io) [![devDependencies Status](https://david-dm.org/deepstreamIO/deepstream.io/dev-status.svg)](https://david-dm.org/deepstreamIO/deepstream.io?type=dev)

### Quick links to useful resources on getting started:

1. [Installing deepstream](https://deepstream.io/install/)
2. [Getting started](https://deepstream.io/tutorials/core/getting-started-quickstart/)
3. [Tutorials](https://deepstream.io/tutorials/)
4. [Documentation](https://deepstream.io/docs/)
5. Deploying on [AWS](https://www.youtube.com/watch?v=VN_qI8a6H34)

### Community Links

1. [Slack](https://deepstreamio-slack.herokuapp.com/)
2. [Twitter](https://twitter.com/deepstreamHub)
3. [Stack Overflow](https://stackoverflow.com/questions/tagged/deepstream.io)

### Development Guide

Deepstream development is a great way for you to go into depth about building performant nodeJS applications, and contributions are always welcome with lots of ❤

Contributing to deepstream.io is as simple as:

1. Downloading [nodeJS](https://nodejs.org/en/) (4+)
2. Cloning the repo
3. Run `npm i` / `yarn install` to install dependencies
4. Make your changes / Add a test
5. Run `npm t` to see if the unit tests all pass
6. Run `sh ./scripts/run-e2e.sh` if your changes are quite big. But otherwise CI can take care of that for you ;)

For power users who want to make sure the binary works, you can run `sh scripts/package.sh true`. You'll need to download the usual [node-gyp](https://github.com/nodejs/node-gyp) build environment for this to work and we only support the latest LTS version to compile. This step is usually not needed though unless your modifying resource files or changing dependencies.

### Post release sanity test for linux distributions:

1. access a linux machine

2. copy over the sanity test using:

`curl -O https://raw.githubusercontent.com/deepstreamIO/deepstream.io/master/scripts/sanity-test.sh`

3. depending on your distribution, run

- debian/ubuntu: `bash sanity-test.sh deb`
- centos/aws: `bash sanity-test.sh rpm`
- any linux distro: `bash sanity-test.sh tar`
