var AmqpConnector = require( 'deepstream.io-msg-amqp' );


var Deepstream = require( './src/deepstream.io' ).Deepstream;

var deepStream = new Deepstream();

deepStream.set( 'messageConnector', new AmqpConnector({
	host: 'localhost',
	port: 5672
}));



( new Deepstream() ).start();