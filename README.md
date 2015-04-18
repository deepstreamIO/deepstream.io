deepstream.io ![Build](https://travis-ci.org/hoxton-one/deepstream.io.svg?branch=master)
==============================================
A scalable server for realtime apps
----------------------------------------------

**Disclaimer** deepstream.io is nearing feature completion, but that's a very different thing to being done. It's not officially released yet. Use at your own risk.

Quickstart
---------------------------------------------

### Installing the server
- Install via npm `npm install deepstream.io`
- Create a file with the following content
```javascript
var Deepstream = require( 'deepstream.io' );
var deepstream = new Deepstream();
// add configuration here, e.g.
// deepstream.set( 'port', 1234 );
deepstream.start();
```
- run this file with node, e.g. `node myFileName`

### Installing the client
- Install via npm `npm install deepstream.io-client-js`
- Now you can do things like
```javascript
  var deepstream = require( 'deepstream.io-client-js' );
  var client = deepstream( 'localhost:6020' );
  
  client.login();
  
  // get a record
  car = client.record.getRecord( 'car' );
  
  // subscribe to a path within the record
  car.subscribe( 'color', function( color ) {
    console.log( 'color is now ', color );
  });
  
  // set the path
  car.set( 'color', 'purple');
  
  // provide a remote procedure call
  client.rpc.provide( 'addTwo', function( data, response ){
    response.send( data.numberA + data.numberB );
  });
  
  // invoke the remote procedure call
  client.rpc.make( 'addTwo', {numberA: 3, numberB: 5 }, function( err, result ){
  
  });
  
  // subscribe to events
  client.event.subscribe( 'stuff', function( data ){
    console.log( 'stuff happened' , data );
  });
  
  // emit an event
  client.event.emit( 'stuff', 'lots' );
```

Connectors
---------------------------------------------
Deepstream can connect to up to three different systems.

- **A Message Bus** allows multiple deepstream instances to communicate and thereby falicitates clustering
- **A Cache** can be used for short term data storage with low read- and write times
- **A Database** can be used for long term data storage and querying

These connectors are currently available (more to come)

### Messaging
- [Direct message connector](https://github.com/hoxton-one/deepstream.io-msg-direct) connects deepstream instances directly via tcp
- [Redis message connector](https://github.com/hoxton-one/deepstream.io-msg-redis) uses Redis' Pub-Sub mechanism for messaging
- [AMQP message connector](https://github.com/hoxton-one/deepstream.io-msg-amqp) connects deepstream to an AMQP broker, e.g. RabbitMQ, HornetQ, Qpid
- [Kraken message connector](https://github.com/hoxton-one/deepstream.io-msg-kraken) uses the Kraken pub-sub server for messaging

### Cache
- [Redis cache connector](https://github.com/hoxton-one/deepstream.io-cache-redis) Connects to Redis
- [Memcached cache connector](https://github.com/hoxton-one/deepstream.io-cache-memcached) Connects to the Memcached distributed cache

### Storage
- [RethinkDb storage connector](https://github.com/hoxton-one/deepstream.io-storage-rethinkdb) Connects to RethinkDB
- [MongoDB storage connector](https://github.com/hoxton-one/deepstream.io-storage-mongodb) Connects to MongoDB

If you'd like to create your own connector, just fork or clone the [cache and storage connector template](https://github.com/hoxton-one/deepstream.io-storage-mongodb) for cache and storage connections or the [message connector template](https://github.com/hoxton-one/deepstream.io-msg-connector-template) for messaging

Configuring the server
---------------------------------------------
Deepstream can be configured using the `set( key, value)` method. These are the supported keys (and example values):

```javascript
var server = new Deepstream();

/**
* A unique name for this server
*
* @type String
* @default A random ID
*/
server.set( 'serverName', 'nodeA' );

/**
* Whether the console output should be in color
*
* @type Boolean
* @default true
*/
server.set( 'colors', false );

/**
* Whether the deepstream logo should be displayed on startup
*
* @type Boolean
* @default true
*/
server.set( 'showLogo', false );

/**
* The host that deepstream listens on for incoming connections from browsers
*
* @type String
* @default '0.0.0.0'
*/
server.set( 'host', 'localhost' );

/**
* The port that deepstream listens on for incoming connections from browsers
*
* @type Number
* @default 6020
*/
server.set( 'port', 80 );

/**
* The host that deepstream listens on for incoming connections via tcp
*
* @type String
* @default '0.0.0.0'
*/
server.set( 'tcpHost', 'localhost' );

/**
* The port that deepstream listens on for incoming connections via tcp
*
* @type Number
* @default 6021
*/
server.set( 'tcpPort', 80 );

/**
* A class that exposes a isValidUser and canPerformAction method. Please see 
* https://github.com/hoxton-one/deepstream.io/blob/master/src/default-plugins/open-permission-handler.js
* for the implementation of the (default) open permission handler
*
* @type PermissionHandler
* @default OpenPermissionHandler
*/
server.set( 'PermissionHandler', new LdapPermissionHandler() );

/**
* A logger, defaults to the STDOUT / STDERROR logger
* see https://github.com/hoxton-one/deepstream.io/blob/master/src/default-plugins/std-out-logger.js
* for implementation
*
* @type Logger
* @default StdOutLogger
*/
server.set( 'Logger', new FileLogger() );

/**
* MessageConnectors connect deepstream to a message bus (e.g. AMQP, Redis, Kafka) thus allowing for clustering
* See the "Connectors" section above for details
*
* @type MessageConnector
* @default NoopMessageConnector
*/
server.set( 'messageConnector', new RedisMessageConnector({
  port: 6379,
  host: 'localhost' 
}));

/**
* Cache connector connect deepstream to a (distributed) cache (e.g. Redis, Memcached) for temporary
* data-storage
* See the "Connectors" section above for details
*
* @type CacheConnector
* @default LocalCache
*/
server.set( 'cache', new RedisCacheConnector({
  port: 6379,
  host: 'localhost' 
}));

/**
* Storage connectors connect deepstream to a database (e.g. RethinkDB, MongoDB) for long term
* data storage and querying
* See the "Connectors" section above for details
*
* @type StorageConnector
* @default NoopStorageConnector
*/
server.set( 'storage', new RethinkDbConnector({
  port: 28015,
  host: 'localhost',
  splitChar: '/',
  defaultTable: 'dsTestDefault'
}));

/**
* Number of times a client can try to authenticate with invalid credentials
* before its connection is closed
*
* @type Number
* @default 3
*/
server.set( 'maxAuthAttempts', Infinity );

/**
* Whether the data provided for invalid auth attempts should be send to the logger
*
* @type Boolean
* @default true
*/
server.set( 'logInvalidAuthData', false );

/**
* The time (in milliseconds) that deepstream allows for RPC providers to respond to queries.
* (When deepstream is asked to execute a RPC that it doesn't have any cached providers for it
* sends out a query message, asking all connected instances if they can provide this RPC. This is
* the timeout that determines how long deepstream will wait for their response)
* This is different from rpcAckTimeout 
*
* @type Number
* @default 1000
*/
server.set( 'rpcProviderQueryTimeout', 5000 );

/**
* The time (in milliseconds) that deepstream allows for RPC providers to acknowledge that they've
* received a request
*
* @type Number
* @default 1000
*/
server.set( 'rpcAckTimeout', 200 );

/**
* The time (in milliseconds) that deepstream allows for RPC providers to send a response
*
* @type Number
* @default 10000
*/
server.set( 'rpcTimeout', 2000 );

/**
* The time (in milliseconds) that deepstream caches its list of rpcProviders for
*
* @type Number
* @default 60000
*/
server.set( 'rpcProviderCacheTime', 120000 );

/**
* The time (in milliseconds) that deepstream allows for data to be retrieved from the cache
*
* @type Number
* @default 1000
*/
server.set( 'cacheRetrievalTimeout', 200 );

/**
* The time (in milliseconds) that deepstream allows for data to be retrieved from the database
*
* @type Number
* @default 2000
*/
server.set( 'storageRetrievalTimeout', 4000 );

/**
* The time (in milliseconds) that deepstream allows for dependencies (Cache Connector, Logger etc.)
* to complete their initialisation
*
* @type Number
* @default 2000
*/
server.set( 'storageRetrievalTimeout', 4000 );


server.start();
```
