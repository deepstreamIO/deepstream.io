'use strict';

const DefaultLogger = require( '../default-plugins/std-out-logger' );

const fs = require( 'fs' );
const utils = require( '../utils/utils' );
const C = require( '../constants/constants' );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );

const fileUtils = require( './file-utils' );
var commandLineArguments;

/**
 * Takes a configuration object and instantiates functional properties.
 * CLI arguments will be considered.
 *
 * @param   {Object} config configuration
 *
 * @returns {Object} configuration
 */
exports.initialise = function( config ) {
	commandLineArguments = global.deepstreamCLI || {};

	handleUUIDProperty( config );
	handleSSLProperties( config );
	handleLogger( config );
	handlePlugins( config );
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
 * Load the SSL files
 * CLI arguments will be considered.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleSSLProperties( config ) {
	var sslFiles = [ 'sslKey', 'sslCert', 'sslCa' ];
	var key, resolvedFilePath, filePath;
	for( var i = 0; i < sslFiles.length; i++ ) {
		key = sslFiles[ i ];
		filePath = config[ key ];
		if( !filePath ) {
			continue;
		}
		resolvedFilePath = fileUtils.lookupConfRequirePath( filePath );
		try {
			config[ key ] = fs.readFileSync( resolvedFilePath, 'utf8' );
		} catch( e ) {
			throw new Error( `The file path "${resolvedFilePath}" provided by "${key}" does not exist.` );
		}
	}
}

/**
 * Initialize the logger and overwrite the root logLevel if it's set
 * CLI arguments will be considered.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleLogger( config ) {
	let configOptions = ( config.logger || {} ).options;
	let Logger;
	if ( config.logger == null || config.logger.name === 'default' ) {
		Logger = DefaultLogger;
	} else {
		Logger = resolvePluginClass( config.logger, 'logger' );
	}

	if( configOptions instanceof Array ) {
		// Note: This will not work on options without filename, and
		// is biased against for the winston logger
		var options;
		for( var i=0; i<configOptions.length; i++ ) {
			options = configOptions[ i ].options;
			if( options && options.filename ) {
				options.filename = fileUtils.lookupConfRequirePath( options.filename );
			}
		}
	}

	config.logger = new Logger( configOptions );
	if ( LOG_LEVEL_KEYS.indexOf( config.logLevel ) !== -1 ) {
		// NOTE: config.logLevel has highest priority, compare to the level defined
		// in the nested logger object
		config.logLevel = C.LOG_LEVEL[ config.logLevel ];
		config.logger.setLogLevel( config.logLevel );
	}
}

/**
 * Handle the plugins property in the config object the connectors.
 * Allowed types: {message|cache|storage}
 * Plugins can be passed either as a __path__ property or as a __name__ property with
 * a naming convetion: *{cache: {name: 'redis'}}* will be resolved to the
 * npm module *deepstream.io-cache-redis*
 * Exception: *message* will be resolved to *msg*
 * Options to the constructor of the plugin can be passed as *options* object.
 *
 * CLI arguments will be considered.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handlePlugins( config ) {
	if ( config.plugins == null ) {
		return;
	}
	// mappnig between the root properties which contains the plugin instance
	// and the plugin configuration objects
	var connectorMap = {
		'messageConnector': 'message',
		'cache': 'cache',
		'storage': 'storage'
	};
	// mapping between the plugin configuration properties and the npm module
	// name resolution
	var typeMap = {
		'message': 'msg',
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
			var pluginConstructor = resolvePluginClass( plugin, typeMap[connectorMap[key]] );
			config[key] = new pluginConstructor( plugin.options );
		}
	}
}

/**
 * Instantiate the given plugin, which either needs a path property or a name
 * property which fits to the npm module name convention. Options will be passed
 * to the constructor.
 *
 * CLI arguments will be considered.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {Function} Instance return be the plugin constructor
 */
function resolvePluginClass( plugin, type ) {
	// nexe needs *global.require* for __dynamic__ modules
	// but browserify and proxyquire can't handle *global.require*
	var req = global && global.require ? global.require : require;
	var requirePath;
	var pluginConstructor;
	if ( plugin.path != null ) {
		requirePath = fileUtils.lookupLibRequirePath( plugin.path );
		pluginConstructor = req( requirePath );
	} else if ( plugin.name != null ) {
		if ( type != null ) {
			requirePath = 'deepstream.io-' + type + '-' + plugin.name;
			requirePath = fileUtils.lookupLibRequirePath( requirePath );
			pluginConstructor = req( requirePath );
		}
	} else {
		throw new Error( 'Neither name nor path property found for ' + type );
	}
	return pluginConstructor;
}

/**
 * Instantiates the authentication handler registered for *config.auth.type*
 *
 * CLI arguments will be considered.
 *
 * @param   {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleAuthStrategy( config ) {
	var authStrategies = {
		none: require( '../authentication/open-authentication-handler' ),
		file: require( '../authentication/file-based-authentication-handler' ),
		http: require( '../authentication/http-authentication-handler' )
	};

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

	if( config.auth.options && config.auth.options.path ) {
		config.auth.options.path = fileUtils.lookupConfRequirePath( config.auth.options.path );
	}

	config.authenticationHandler = new ( authStrategies[ config.auth.type ] )( config.auth.options, config.logger );
}

/**
 * Instantiates the permission handler registered for *config.permission.type*
 *
 * CLI arguments will be considered.
 *
 * @param   {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handlePermissionStrategy( config ) {
	var permissionStrategies = {
		config: require( '../permission/config-permission-handler' ),
		none: require( '../permission/open-permission-handler' )
	};

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

	if( config.permission.options && config.permission.options.path ) {
		config.permission.options.path = fileUtils.lookupConfRequirePath( config.permission.options.path );
	}

	config.permissionHandler = new ( permissionStrategies[ config.permission.type ] )( config );
}
