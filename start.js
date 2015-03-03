//require('v8-profiler');


var Deepstream = require( './src/deepstream.io' );
	// AmqpConnector = require( 'deepstream.io-msg-amqp' ),
	// redis = require( 'deepstream.io-redis' );


var deepstream = new Deepstream();

// deepstream.set( 'host', process.env.IP );
// deepstream.set( 'port', process.env.PORT );

// deepstream.set( 'messageConnector', new AmqpConnector({
// 	// Remote
// 	// login: 'nwixdpxf',
// 	// vhost: 'nwixdpxf',
// 	// password: 'YYY',
// 	// host: 'bunny.cloudamqp.com'
	
// 	//Local
// 	host: 'localhost',
// 	port: 5672
// }));

// deepstream.set( 'permissionHandler', {
// 	isValidUser: function( handshakeData, authData, callback ) {
// 		if( authData.username === 'Wolfram' ) {
// 			callback( null, authData.username );
// 		} else {
// 			callback( 'Invalid user' );
// 		}
		
// 	},

// 	canPerformAction: function( username, message, callback ) {
// 		callback( null, true );
// 	}
// });

// var redisOptions = {
// 	// Remote
// 	port: 15010,
// 	host: 'pub-redis-15010.us-east-1-4.4.ec2.garantiadata.com',
// 	password: 'YYY'
	

// 	//Local
// 	// port: 6379,
// 	// host: 'localhost'
// }; 

// deepstream.set( 'cache', new redis.CacheConnector( redisOptions ));

// deepstream.set( 'messageConnector', new redis.MessageConnector({
// 	port: 15010,
// 	host: 'pub-redis-15010.us-east-1-4.4.ec2.garantiadata.com',
// 	password: 'YYY'
// }));

deepstream.start();