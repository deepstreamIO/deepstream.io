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
var Deepstream = require( './src/deepstream.io' );
var deepstream = new Deepstream();
// add configuration here, e.g.
// deepstream.set( 'port', 1234 );
deepstream.start();
```
- run this file with node, e.g. `node myFileName`


### Installing the client
- Install via npm `npm install deepstream.io-client-js
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