var Deepstream = require( './src/deepstream.io' ),
	AmqpConnector = require( 'deepstream.io-msg-amqp' ),
	RedisConnector = require( 'deepstream.io-redis' );

var deepstream = new Deepstream();

deepstream.set( 'messageConnector', new AmqpConnector({
	// Remote
	login: 'nwixdpxf',
	vhost: 'nwixdpxf',
	password: 'JTLFB247N7tTiP6KMGGmGxtMcK0j4TJm',
	host: 'bunny.cloudamqp.com'
	// Local
	// host: 'localhost',
	// port: 5672
}));

deepstream.set( 'cache', new RedisConnector({
	port: 15010,
	host: 'pub-redis-15010.us-east-1-4.4.ec2.garantiadata.com',
	password: 'Arbiter'
}));

deepstream.start();