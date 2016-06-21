'use strict';

const DefaultLogger = require( 'deepstream.io-logger-winston' );

const fs = require( 'fs' );
const utils = require( '../utils/utils' );
const C = require( '../constants/constants' );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );

const fileUtils = require( './file-utils' );
var commandLineArguments;

/**
 * Takes a configuration object and instantiates functional properties
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
 * Replace the ssl config with paths
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
 * Transform log level string (enum) to its internal value
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleLogger( config ) {
	let configOptions = ( config.logger || {} ).options;
	let Logger;
	if ( config.logger == null ) {
		Logger = DefaultLogger;
	} else {
		Logger = resolvePluginClass( config.logger, 'logger' );
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
			var pluginConstructor = resolvePluginClass( plugin, connectors[key] );
			config[key] = new pluginConstructor( plugin.options );
		}
	}
}

function resolvePluginClass( plugin, type ) {
	// nexe needs global.require for "dynamic" modules
	// but browserify and proxyquire can't handle global.require
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
 * Instantiates the authenticationhandler registered for
 * config.auth.type
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

	config.permissionHandler = new ( permissionStrategies[ config.permission.type ] )( config.permission.options );
}