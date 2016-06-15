'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const yaml = require( 'js-yaml' );
const defaultOptions = require( '../default-options' );
const utils = require( './utils' );
const ConfigPermissionHandler = require( '../permission/config-permission-handler' );
const C = require( '../constants/constants' );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );
const SUPPORTED_EXTENSIONS = [ '.yml', '.json', '.js' ];
var commandLineArguments = require( 'minimist' )( process.argv.slice( 2 ) );
var authStrategies = {
	none: require( '../authentication/open-authentication-handler' ),
	file: require( '../authentication/file-based-authentication-handler' ),
	http: require( '../authentication/http-authentication-handler' )
};

/**
 * Reads and parse a general configuraiton file content.
 *
 * @param {String} filePath
 * @param {Function} callback
 *
 * @public
 * @returns {void}
 */
exports.readAndParseFile = function( filePath, callback ) {
	try{
		fs.readFile( filePath, 'utf8', function( error, fileContent ) {
			if ( error ) {
				return callback ( error );
			}

			try {
				var config = parseFile( filePath, fileContent );
				return callback( null, config );
			} catch ( error ) {
				return callback ( error );
			}
		} );
	} catch( error ) {
		callback( error );
	}
};

/**
 * This method executes parallel exists-checks for
 * each file extension specified in SUPPORTED_EXTENSIONS.
 *
 * Callback is invoked with an error for anything but exactly one
 * readable file under the given path
 *
 * @param   {String}   basePath folder/file path without extension
 * @param   {Function} callback Will be invoked with error|null and existing file path
 *
 * @public
 * @returns {void}
 */
exports.getExistingFilePath = function( basePath, callback ) {
	var existingPath;
	var checkedPath;
	var checksCompleted = 0;
	var i;
	var isComplete = false;

	var complete = function( error, filePath ) {
		if( isComplete === false ) {
			isComplete = true;
			callback( error, filePath );
		}
	};

	var onAccessible = function( checkedPath, err ) {
		checksCompleted++;

		if( err === null ) {
			if( existingPath ) {
				complete( 'Ambiguous Filepaths: found both ' + checkedPath + ' and ' + existingPath );
			} else {
				existingPath = checkedPath;
			}
		}

		if( checksCompleted === SUPPORTED_EXTENSIONS.length ) {
			if( existingPath ) {
				complete( null, existingPath );
			} else {
				complete( 'no file found at ' + basePath );
			}
		}
	};

	for( i = 0; i < SUPPORTED_EXTENSIONS.length; i++ ) {
		checkedPath = basePath + SUPPORTED_EXTENSIONS[ i ];
		fs.access( checkedPath, fs.R_OK, onAccessible.bind( this, checkedPath ) );
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
 * @param {Object} args minimist arguments
 *
 * @public
 * @returns {Object} config deepstream configuration object
 */
module.exports.loadConfig = function( args ) {
	var argv = args || commandLineArguments;
	var customConfigPath = argv.c || argv.config;
	var configPath = customConfigPath ? verifyCustomConfigPath( customConfigPath ) : getDefaultConfigPath();
	var configString = readConfigFileSync( configPath )
	var rawConfig = parseFile( configPath, configString );
	var config = initialiseConfig( rawConfig, argv, path.dirname( configPath ) );

	return {
		config: config,
		file: configPath
	};
};

function readConfigFileSync( configFilePath ) {
	try{
		return fs.readFileSync( configFilePath, { encoding: 'utf8' } )
	} catch( error ) {
		console.error( 'Error while reading config file from ' + configFilePath );
		throw error;
	}
}

function initialiseConfig( config, argv, configDir ) {
	var cliArgs = {};
	var key;

	for ( key in defaultOptions.get() ) {
		cliArgs[key] = argv[key] || undefined;
	}

	if( config.auth && config.auth.options && config.auth.options.path ) {
		config.auth.options.path = handleRelativeAndAbsolutePath( config.auth.options.path, configDir );
	}

	if( config.permission && config.permission.options && config.permission.options.path ) {
		config.permission.options.path = handleRelativeAndAbsolutePath( config.permission.options.path, configDir );
	}

	return handleMagicProperties( utils.merge( {}, defaultOptions.get(), config, cliArgs ), argv );
};

function verifyCustomConfigPath( configPath ) {
	if( fileExistsSync( configPath ) ) {
		return configPath;
	} else {
		throw new Error( 'configuration file not found at: ' + configPath );
	}
}

function getDefaultConfigPath() {
	var defaultConfigBaseName = path.join( 'config', 'config' );
	var filePath, i;

	for( i = 0; i < SUPPORTED_EXTENSIONS.length; i++ ) {
		filePath = defaultConfigBaseName + SUPPORTED_EXTENSIONS[ i ];
		
		if( fileExistsSync( filePath ) ) {
			return filePath;
		}
	}

	throw new Error( 'No config file found' );
}

function fileExistsSync( path ) {
	try{
		fs.lstatSync( path );
		return true;
	} catch( e ) {
		return false;
	}
}

/**
 * Handle configuration properties which are transformed into non trivial
 * data types
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleMagicProperties( config, argv ) {
	var _config = utils.merge( {
		plugins: {}
	}, config );

	handleUUIDProperty( _config );
	handleLogLevel( _config );
	handlePlugins( _config, argv );

	handleAuthStrategy( _config );
	handlePermissionStrategy( _config );

	return _config;
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
		return handleRelativeAndAbsolutePath( filePath, libDir );
	}
	else {
		return filePath;
	}
}

/**
 * If a prefix is not set the filePath will be returned
 *
 * Otherwise it will either replace return a new path prepended with the prefix.
 * If the prefix is not an absolute path it will also prepend the CWD.
 *
 * @param {String} filePath
 * @param {String} prefix
 *
 * @private
 * @returns {String} file path with the prefix
 */
function handleRelativeAndAbsolutePath( filePath, prefix ) {
	if ( path.parse( prefix ).root !== '' ) {
		return path.join( prefix, filePath );
	} else {
		return path.join( process.cwd(), prefix, filePath );
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