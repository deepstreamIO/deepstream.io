'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const yaml = require( 'js-yaml' );
const defaultOptions = require( '../default-options' );
const ConfigPermissionHandler = require( '../permission/config-permission-handler' );
const utils = require( './utils' );
const C = require( '../constants/constants' );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );

/**
 * Reads and parse a general configuraiton file content.
 *
 * @param {String} filePath
 * @param {Function} callback
 *
 * @public
 * @returns {void}
 */
module.exports.readAndParseFile = function( filePath, callback ) {
	try {
		fs.readFile( filePath, 'utf8', function( error, fileContent ) {
			if ( error ) {
				return callback ( error );
			}
			try {
				const config = parseFile( filePath, fileContent );
				return callback( null, config );

			} catch ( error ) {
				return callback ( error );
			}
		} );
	} catch ( error ) {
		return callback ( error );
	}
};

/**
 * Parse a general configuration file
 * These file extension ans formats are allowed:
 * .yml, .js, .json
 *
 * If no fileContent is passed the file is read synchronously
 *
 * @param {String} filePath
 * @param {String} fileContent
 *
 * @private
 * @returns {Object} config
 */
function parseFile( filePath, fileContent ) {
	if ( fileContent == null ) {
		fileContent = fs.readFileSync( filePath, {encoding: 'utf8'} );
	}
	let config = null;
	const extension = path.extname( filePath );

	if ( extension === '.yml' ) {
		config = yaml.safeLoad( fileContent );
	} else if ( extension === '.js' ) {
		config = require( path.resolve( filePath ) );
	} else if ( extension === '.json' ) {
		config = JSON.parse( fileContent );
	} else {
		throw new Error( extension + ' is not supported as configuration file' );
	}

	return config;
}

/**
 * Loads a file as deepstream config. CLI args have highest priority after the
 * configuration file. If some properties are not set they will be defaulted
 * to default values defined in the defaultOptions.js file.
 * Configuraiton file will be transformed to a deepstream object by evaluating
 * some properties like the plugins (logger and connectors).
 *
 * @param {Object} argv minimist arguments
 *
 * @public
 * @returns {Object} config deepstream configuration object

 */
module.exports.loadConfig = function( argv ) {
	if ( argv == null ) {
		argv = {};
	}
	var _configFile = argv.c || argv.config;
	var _libPrefix = argv.l || argv.libPrefix;

	var cliOptions = {
		configPrefix: process.cwd()
	};

	var customFilePath = undefined;
	if( _configFile ) {
		customFilePath = _configFile;
		cliOptions.configPrefix = path.dirname( _configFile );
	}
	if ( _libPrefix ) {
		cliOptions.libPrefix = _libPrefix;
	}
	const filePath = findFilePath( customFilePath );
	if ( filePath == null ) {
		return {
			config: appendPermissionHandler( defaultOptions.get(), cliOptions ),
			file: null
		};
	}
	const config = parseFile( filePath );
	// CLI arguments
	var cliArgs = {};
	for ( let key in Object.keys( defaultOptions.get() ) ) {
		cliArgs[key] = argv[key] || undefined;
	}

	let result = handleMagicProperties( utils.merge( {}, defaultOptions.get(), config, cliArgs ), cliOptions );
	return {
		config: appendPermissionHandler( result, cliOptions ),
		file: filePath
	};
};

/**
 * Calling handlePermissionFile and initializing the ConfigPermissionHandler
 *
 * @param {Object} config deepstream configuration object
 * @param {Object} cliOptions CLI arguments from the CLI interface
 *
 * @private
 * @returns {void}
 */
function appendPermissionHandler( config, cliOptions ) {
	handlePermissionFile( config, cliOptions );
	config.permissionHandler = new ConfigPermissionHandler( config );
	return config;
}

/**
 * Does lookups for the depstream configuration file.
 * Lookup order: config.json, config.js, config.yml
 * The order will be ignored if customFilePath  will be passed.
 *
 * @param {String} customFilePath
 *
 * @private
 * @returns {String} filePath
 */
function findFilePath( customFilePath ) {
	const order = [
		'config.json',
		'config.js',
		'config.yml'
	];
	let filePath = null;

	if ( customFilePath != null ) {
		try {
			fs.lstatSync( customFilePath );
			filePath = customFilePath;
		} catch ( err ) {
			throw new Error( 'configuration file not found at: ' + customFilePath );
		}
	} else {
		filePath = order.filter( function( filePath ) {
			try {
				fs.lstatSync( filePath );
				return true;
			} catch ( err ) {}
		} )[ 0 ];
	}
	return filePath;
}

/**
 * Handle configuration properties which are transformed into non trivial
 * data types
 *
 * @param {Object} config deepstream configuration object
 * @param {Object} cliOptions CLI arguments from the CLI interface
 *
 * @private
 * @returns {void}
 */
function handleMagicProperties( cfg, cliOptions ) {
	const config = utils.merge( {
		plugins: {}
	}, cfg );

	handleUUIDProperty( config );
	handleLogLevel( config );
	handlePlugins( config, cliOptions );

	return config;
}

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
 * Handle configPrefix for permission config file.
 * configPrefix needs to be set in the cliOptions.
 *
 *
 * @param {Object} config deepstream configuration object
 * @param {Object} cliOptions CLI arguments from the CLI interface
 *
 * @private
 * @returns {vpod}
 */
function handlePermissionFile( config, cliOptions ) {
	var prefix = cliOptions.configPrefix;
	if ( prefix ) {
		if ( prefix[ 0 ] === '/' ) {
			config.permissionConfigPath = path.join( prefix, config.permissionConfigPath );
		} else {
			config.permissionConfigPath = path.join( process.cwd(), prefix, config.permissionConfigPath );
		}
	}
}

/**
 * If libPrefix is not set the filePath will be returned
 *
 * Otherwise it will either replace the lookup path instead of node_modules
 * if the libPrefix is absolute.
 * If the libPrefix is not absolute it will append the libPrefix to the CWD
 *
 * @param {String} filePath
 * @param {Object} cliOptions CLI arguments from the CLI interface
 *
 * @private
 * @returns {String} file path with the libPrefix set in cliOptions
 */
function considerLibPrefix( filePath, cliOptions ) {
	if ( cliOptions.libPrefix == null ) {
		return filePath;
	}
	if ( cliOptions.libPrefix[ 0 ] === '/' ) {
		return path.join( cliOptions.libPrefix, filePath );
	} else {
		return path.join( process.cwd(), cliOptions.libPrefix, filePath );
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
 * @param {Object} config deepstream configuration object
 * @param {Object} cliOptions CLI arguments from the CLI interface
 *
 * @private
 * @returns {void}
 */
function handlePlugins( config, cliOptions ) {
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
					requirePath = considerLibPrefix( plugin.path, cliOptions );
				}
				fn = require( requirePath );
			} else if ( plugin.name != null ) {
				var connectorKey = key;
				if ( connectors.indexOf( connectorKey ) !== -1 ) {
					if ( connectorKey === 'messageConnector' ) {
						connectorKey = 'msg';
					}
					requirePath = 'deepstream.io-' + connectorKey + '-' + plugin.name;
					requirePath = considerLibPrefix( requirePath, cliOptions );
					fn = req( requirePath );
				} else if ( key === 'logger' && plugin.name === 'default' ) {
					fn = req( '../default-plugins/std-out-logger' );
				}
			}
			if ( key === 'logger' ) {
				config[key] = fn;
			} else {
				config[key] = new fn( plugin.options );
			}
		}
	}
}
