'use strict';

const Logger = require( 'deepstream.io-logger-winston' );
const C = require( '../constants/constants' );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );
const utils = require( './utils' );
var commandLineArguments;

var authStrategies = {
	none: require( '../authentication/open-authentication-handler' ),
	file: require( '../authentication/file-based-authentication-handler' ),
	http: require( '../authentication/http-authentication-handler' )
};
var permissionStrategies = {
	config: require( '../permission/config-permission-handler' ),
	none: require( '../permission/open-permission-handler' )
};

/**
 * Takes a configuration object and instantiates functional properties
 *
 * @param   {Object} config configuration
 * @param   {Object} argv   command line args
 *
 * @returns {Object} configuration
 */
exports.initialise = function( config, argv ) {
	commandLineArguments = process.deepstreamCLI || {};

	handleUUIDProperty( config );
	handleLogger( config );
	handlePlugins( config, argv );
	handleAuthStrategy( config );
	handlePermissionStrategy( config );

	return config;
};

/**
 * Transform the UUID string config to a UUID in the config object.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleUUIDProperty( config ) {
	if ( config.serverName === 'UUID' ) {
		config.serverName = utils.getUid();
	}
}

/**
 * Transform log level string (enum) to its internal value
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleLogger( config ) {
	let configClazz;
	let configOptions = ( config.logger || {} ).options;
	if ( config.logger == null || config.logger.type === 'default' ) {
		configClazz = Logger;
	} else if ( config.logger.type === 'custom' ) {
		const requirePath = utils.lookupRequirePath( config.logger.path );
		configClazz = require( requirePath );
	} else {
		throw new Error( 'logger type ' + config.logger.type + ' not supported' );
	}
	config.logger = new configClazz( configOptions );
	if ( LOG_LEVEL_KEYS.indexOf( config.logLevel ) !== -1 ) {
		// TODO: config.logLevel is obsolete
		config.logLevel = C.LOG_LEVEL[ config.logLevel ];
		config.logger.setLogLevel( C.LOG_LEVEL[ config.logLevel ] );
	}
}

/**
 * Handle the plugins property in the config object
 * for logger and the connectors.
 * Modifies the config object and load the logger and connectors
 * and passing options for the connectors
 * Plugins can be passed either as a `path` property  - a relative to the
 * working directory, or the npm module name - or as a `name` property with
 * a naming convetion: `{message: {name: 'redis'}}` will be resolved to the
 * npm module `deepstream.io-msg-direct`
 * cliOptions can modify the lookup path for the plugins via libPrefix property
 *
 * @todo  refactor
 *
 * @param {Object} config deepstream configuration object
 * @param {Object} argv CLI arguments from the CLI interface
 *
 * @private
 * @returns {void}
 */
function handlePlugins( config, argv ) {
	if ( config.plugins == null ) {
		return;
	}
	// nexe needs global.require for "dynamic" modules
	// but browserify and proxyquire can't handle global.require
	var req = global && global.require ? global.require : require;
	var connectors = [
		'messageConnector',
		'cache',
		'storage'
	];
	var plugins = {
		messageConnector: config.plugins.message,
		cache: config.plugins.cache,
		storage: config.plugins.storage
	};
	var requirePath;
	for ( let key in plugins ) {
		var plugin = plugins[key];
		if ( plugin != null ) {
			var fn = null;
			if ( plugin.path != null ) {
				if ( plugin.path[ 0 ] !== '.' ) {
					requirePath = plugin.path;
				} else {
					requirePath = considerLibPrefix( plugin.path, argv );
				}
				fn = require( requirePath );
			} else if ( plugin.name != null ) {
				var connectorKey = key;
				if ( connectors.indexOf( connectorKey ) !== -1 ) {
					if ( connectorKey === 'messageConnector' ) {
						connectorKey = 'msg';
					}
					requirePath = 'deepstream.io-' + connectorKey + '-' + plugin.name;
					requirePath = considerLibPrefix( requirePath, argv );

					fn = req( requirePath );
				}
			}
			config[key] = new fn( plugin.options );
		}
	}
}

/**
 * Instantiates the authenticationhandler registered for
 * config.auth.type
 *
 * @param   {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleAuthStrategy( config ) {
	if( !config.auth ) {
		throw new Error( 'No authentication type specified' );
	}

	if( !authStrategies[ config.auth.type ] ) {
		throw new Error( 'Unknown authentication type ' + config.auth.type );
	}

	if( commandLineArguments.disableAuth ) {
		config.auth.type = 'none';
		config.auth.options = {};
	}

	config.authenticationHandler = new ( authStrategies[ config.auth.type ] )( config.auth.options );
}

/**
 * Instantiates the permissionhandler registered for
 * config.auth.type
 *
 * @param   {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handlePermissionStrategy( config ) {
	if( !config.permission ) {
		throw new Error( 'No permission type specified' );
	}

	if( !permissionStrategies[ config.permission.type ] ) {
		throw new Error( 'Unknown permission type ' + config.permission.type );
	}

	if( commandLineArguments.disablePermissions ) {
		config.permission.type = 'none';
		config.permission.options = {};
	}

	config.permissionHandler = new ( permissionStrategies[ config.permission.type ] )( config.permission.options );
}

/**
 * If libPrefix is not set the filePath will be returned
 * Default lookup is the node_modules directory in the CWD.
 *
 * @param {String} filePath
 *
 * @private
 * @returns {String} file path with the libPrefix set in cliOptions
 */
function considerLibPrefix( filePath, argv ) {
	var libDir = argv.l || argv.libPrefix || commandLineArguments.l || commandLineArguments.libPrefix;

	if ( libDir ) {
		return utils.lookupRequirePath( filePath, libDir );
	}
	else {
		return filePath;
	}
}
