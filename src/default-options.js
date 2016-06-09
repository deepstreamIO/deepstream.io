var utils = require( './utils/utils' ),
	C = require( './constants/constants' );

exports.get = function() {
	var options = {
		/*
		 * General
		 */
		serverName: utils.getUid(),
		colors: true,
		showLogo: true,
		logLevel: C.LOG_LEVEL.INFO,

		/*
		 * Connectivity
		 */
		webServerEnabled: true,
		tcpServerEnabled: true,
		port: 6020,
		host: '0.0.0.0',
		tcpPort: 6021,
		tcpHost: '0.0.0.0',
		httpServer: null,
		urlPath: '/engine.io',


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
		 * Authentication
		 */
		auth: {
			type: 'open'
		},

		/*
		 * Default Plugins
		 */
		logger: require( './default-plugins/std-out-logger' ),
		messageConnector: require( './default-plugins/noop-message-connector' ),
		cache: require( './default-plugins/local-cache' ),
		storage: require( './default-plugins/noop-storage' ),

		/*
		 * Storage options
		 */
		storageExclusion: null,

		/*
		 * Security
		 */
		maxAuthAttempts: 3,
		logInvalidAuthData: true,
		maxMessageSize: 1048576,

		/*
		 * Permissioning
		 */
		permissionType: 'config',
		permissionConfigPath: './permissions.json',
		maxPermissionRuleIterations: 3,
		permissionCacheEvacuationInterval: 60000,

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

	return options;
};
