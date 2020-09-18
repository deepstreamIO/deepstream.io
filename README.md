# deepstream - the open realtime server <a href='https://deepstreamhub.com/open-source/'><img src='./elton-square.png' height='60' alt='deepstream'></a>

deepstream is an open source server inspired by concepts behind financial trading technology. It allows clients and backend services to sync data, send messages and make rpcs at very high speed and scale.

[![Build Status](https://travis-ci.org/deepstreamIO/deepstream.io.svg?branch=master)](https://travis-ci.org/deepstreamIO/deepstream.io) [![npm version](https://badge.fury.io/js/%40deepstream%2Fserver.svg)](https://badge.fury.io/js/%40deepstream%2Fserver)[![dependencies Status](https://david-dm.org/deepstreamIO/deepstream.io/status.svg)](https://david-dm.org/deepstreamIO/deepstream.io) [![devDependencies Status](https://david-dm.org/deepstreamIO/deepstream.io/dev-status.svg)](https://david-dm.org/deepstreamIO/deepstream.io?type=dev)[![Docker Stars](https://img.shields.io/docker/pulls/deepstreamio/deepstream.io.svg)](https://hub.docker.com/r/deepstreamio/deepstream.io/)

deepstream has three core concepts for enabling realtime application development

- **records** ([realtime document sync](https://deepstreamhub.com/tutorials/guides/records/))

records are schema-less, persistent documents that can be manipulated and observed. Any change is synchronized with all connected clients and backend processes in milliseconds. Records can reference each other and be arranged in lists to allow modelling of relational data

- **events** ([publish subscribe messaging](https://deepstreamhub.com/tutorials/guides/events/))

events allow for high performance, many-to-many messaging. deepstream provides topic based routing from sender to subscriber, data serialisation and subscription listening.

- **rpcs** ([request response workflows](https://deepstreamhub.com/tutorials/guides/remote-procedure-calls/))

remote procedure calls allow for secure and highly available request response communication. deepstream handles load-balancing, failover, data-transport and message routing.

### Getting Started:

1. [Installing deepstream](https://deepstream.io/tutorials/install/linux/)
2. [Quickstart](https://deepstream.io/tutorials/getting-started/javascript/)
3. [Tutorials](https://deepstream.io/tutorials/)
4. [Documentation](https://deepstream.io/docs/)

### Community Links

1. [Slack](https://deepstreamio-slack.herokuapp.com/)
2. [Twitter](https://twitter.com/deepstreamHub)
3. [Stack Overflow](https://stackoverflow.com/questions/tagged/deepstream.io)

### Contributing

deepstream development is a great way to get into building performant Node.js applications, and contributions are always welcome with lots of ❤. Contributing to deepstream is as simple as having Node.js (10+) and TypeScript (3+) installed, cloning the repo and making some changes.

```
~ » git clone git@github.com:deepstreamIO/deepstream.io.git
~ » cd deepstream.io
~/deepstream.io » git submodule update --init 
~/deepstream.io » npm i
~/deepstream.io » npm start
      _                     _
   __| | ___  ___ _ __  ___| |_ _ __ ___  __ _ _ __ ____
  / _` |/ _ \/ _ \ '_ \/ __| __| '__/ _ \/ _` | '_ ` _  \
 | (_| |  __/  __/ |_) \__ \ |_| | |  __/ (_| | | | | | |
  \__,_|\___|\___| .__/|___/\__|_|  \___|\__,_|_| |_| |_|
                 |_|
 =====================   starting   =====================
```

From here you can make your changes, and check the unit tests pass:

```
~/deepstream.io » npm t
```

If your changes are substantial you can also run our extensive end-to-end testing framework:

```
~/deepstream.io » npm run e2e
```

For power users who want to make sure the binary works, you can run `sh scripts/package.sh true`. You'll need to download the usual [node-gyp](https://github.com/nodejs/node-gyp) build environment for this to work and we only support the latest LTS version to compile. This step is usually not needed though unless your modifying resource files or changing dependencies.
