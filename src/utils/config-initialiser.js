'use strict';

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
	handleLogger( config, argv );
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
function handleLogger( config, argv ) {
	let configOptions = ( config.logger || {} ).options;
	let Logger;
	if ( typeof config.logger  === 'function' ) {
		Logger = config.logger;
	} else {
		Logger = resolvePluginClass( config.logger, 'logger', argv );
	}
	config.logger = new Logger( configOptions );
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
	var connectors = {
		'messageConnector': 'msg',
		'cache': 'cache',
		'storage': 'storage'
	};
	var plugins = {
		messageConnector: config.plugins.message,
		cache: config.plugins.cache,
		storage: config.plugins.storage
	};

	for ( let key in plugins ) {
		var plugin = plugins[key];
		if ( plugin != null ) {
			var pluginConstructor = resolvePluginClass( plugin, connectors[key], argv );
			config[key] = new pluginConstructor( plugin.options );
		}
	}
}

function resolvePluginClass( plugin, type, argv ) {
	// nexe needs global.require for "dynamic" modules
	// but browserify and proxyquire can't handle global.require
	var req = global && global.require ? global.require : require;
	var requirePath;
	var pluginConstructor;
	if ( plugin.path != null ) {
		requirePath = considerLibPrefix( plugin.path, argv );
		pluginConstructor = req( requirePath );
	} else if ( plugin.name != null ) {
		if ( type != null ) {
			requirePath = 'deepstream.io-' + type + '-' + plugin.name;
			requirePath = considerLibPrefix( requirePath, argv );
			pluginConstructor = req( requirePath );
		}
	} else {
		throw new Error( 'neither name nor path property found for ' + type );
	}
	return pluginConstructor;
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
	if ( argv == null ) {
		argv = {};
	}
	var libDir = argv.l || argv.libPrefix || commandLineArguments.l || commandLineArguments.libPrefix;
	return utils.lookupRequirePath( filePath, libDir );
}
