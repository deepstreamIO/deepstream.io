var argv = require( 'minimist' )( process.argv.slice(2) ),
	utils = require( './utils/utils' ),
	C = require( './constants/constants' );

exports.get = function() {
	return {
		/*
		 * General
		 */
		serverName: utils.getUid(),
		colors: argv.colors === 'false' ? false : true,
		showLogo: true,
		logLevel: C.LOG_LEVEL.INFO,
	
		/*
		 * Connectivity
		 */
		port: argv.port || 6020,
		host: argv.host || '0.0.0.0',
		tcpPort: argv.tcpPort || 6021,
		tcpHost: argv.tcpHost || '0.0.0.0',

		/*
		 * SSL Configuration
		 */
		sslKey: null,
		sslCert: null,
		sslCa: null,

		/*
		 * Data Manipulation
		 */
		dataTransforms: null,
	
		/*
		 * Default Plugins
		 */
		permissionHandler: require( './default-plugins/open-permission-handler' ),
		logger: require( './default-plugins/std-out-logger' ),
		messageConnector: require( './default-plugins/noop-message-connector' ),
		cache: require( './default-plugins/local-cache' ),
		storage: require( './default-plugins/noop-storage' ),
	
		/*
		 * Security
		 */
		maxAuthAttempts: 3,
		logInvalidAuthData: true,
		
		/*
		 * Timeouts
		 */
		rpcProviderQueryTimeout: 1000,
		rpcProviderCacheTime: 60000,
		rpcAckTimeout: 1000,
		rpcTimeout: 10000,
		cacheRetrievalTimeout: 1000,
		storageRetrievalTimeout: 2000,
		dependencyInitialisationTimeout: 2000
	};
};
