'use strict';

const C = require( '../constants/constants' );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );
const ConfigPermissionHandler = require( '../permission/config-permission-handler' );
const utils = require( './utils' );
const path = require( 'path' );

var commandLineArguments = require( 'commander' ).parse( ( process.argv.slice( 2 ) ) || {} );
var authStrategies = {
	none: require( '../authentication/open-authentication-handler' ),
	file: require( '../authentication/file-based-authentication-handler' ),
	http: require( '../authentication/http-authentication-handler' )
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
	handleUUIDProperty( config );
	handleLogLevel( config );
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
function handleLogLevel( config ) {
	if ( LOG_LEVEL_KEYS.indexOf( config.logLevel ) !== -1 ) {
		config.logLevel = C.LOG_LEVEL[ config.logLevel ];
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
		logger: config.plugins.logger,
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
			if ( key === 'logger' ) {
				//TODO No downside in making the logger a class too
				/* istanbul ignore next */
				config[key] = fn;
			} else {
				config[key] = new fn( plugin.options );
			}
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

	config.authenticationHandler = new (authStrategies[ config.auth.type ])( config.auth.options );
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
	if( !config.permission) {
		throw new Error( 'No permission type specified' );
	}

	if( config.permission.type !== 'config' ) {
		throw new Error( 'Unknown permission type ' + config.permission.type ); // TODO other permission types?
	}

	config.permissionHandler = new ConfigPermissionHandler( config.permission.options );
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
		return utils.normalisePath( filePath, libDir );
	}
	else {
		return filePath;
	}
}