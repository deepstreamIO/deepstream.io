


var Deepstream = require( './src/deepstream.io' ).Deepstream;

var deepStream = new Deepstream();

var AmqpConnector = require( 'deepstream.io-msg-amqp' );
deepStream.set( 'messageConnector', new AmqpConnector({
	// Remote
	login: 'nwixdpxf',
	vhost: 'nwixdpxf',
	password: 'JTLFB247N7tTiP6KMGGmGxtMcK0j4TJm',
	host: 'bunny.cloudamqp.com'
	// Local
	// host: 'localhost',
	// port: 5672
}));



( new Deepstream() ).start();