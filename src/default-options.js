var argv = require( 'minimist' )( process.argv.slice(2) );

module.exports = {
	serverName: ( Math.random() * 10000000000000000000 ).toString( 36 ),
	port: argv.port || 6020,
	host: argv.host || '0.0.0.0',
	permissionHandler: require( './default-plugins/open-permission-handler' ),
	logger: require( './default-plugins/std-out-logger' ),
	messageConnector: require( './default-plugins/noop-message-connector' ),

	/*
	 * Security
	 */
	maxAuthAttempts: 3,
	logInvalidAuthData: true,
	
	/*
	 * Timeouts
	 */
	rpcProviderCacheTime: 60000,
	rpcAckTimeout: 100,
	rpcTimeout: 5000
};


