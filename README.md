[deepstream.io](http://deepstream.io/) [![Build Status](https://travis-ci.org/deepstreamIO/deepstream.io.svg?branch=master)](https://travis-ci.org/deepstreamIO/deepstream.io) [![npm version](https://badge.fury.io/js/deepstream.io.svg)](http://badge.fury.io/js/deepstream.io) [![Coverage Status](https://coveralls.io/repos/github/deepstreamIO/deepstream.io/badge.svg?branch=master)](https://coveralls.io/github/deepstreamIO/deepstream.io?branch=master) [![dependencies Status](https://david-dm.org/deepstreamIO/deepstream.io/status.svg)](https://david-dm.org/deepstreamIO/deepstream.io) [![devDependencies Status](https://david-dm.org/deepstreamIO/deepstream.io/dev-status.svg)](https://david-dm.org/deepstreamIO/deepstream.io?type=dev)
==============================================
The Open Realtime Server
----------------------------------------------
deepstream is a new type of server that syncs data and sends events across millions of clients

## https://deepstream.io/

### Post release sanity test for linux distributions:
1. access a linux machine

2. copy over the sanity test using:
  
`curl -O https://raw.githubusercontent.com/deepstreamIO/deepstream.io/sanity-test-linux/scripts/sanity-test.sh`

3. depending on your distribution, run
- debian/ubuntu: `bash sanity-test.sh deb`
- centos/aws: `bash sanity-test.sh rpm`
- any linux distro: `bash sanity-test.sh tar`
