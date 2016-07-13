'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const yaml = require( 'js-yaml' );

const defaultOptions = require( '../default-options' );
const utils = require( '../utils/utils' );

const configInitialiser = require( './config-initialiser' );
const fileUtils = require( './file-utils' );

const SUPPORTED_EXTENSIONS = [ '.yml', '.yaml', '.json', '.js' ];path.join( '.', 'conf', 'config' );
const DEFAULT_CONFIG_DIRS = [ path.join( '.', 'conf', 'config' ), '/etc/deepstream/config', '/usr/local/etc/deepstream/config' ];

/**
 * Reads and parse a general configuration file content.
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

	if ( extension === '.yml' || extension === '.yaml' ) {
		config = yaml.safeLoad( replaceEnvironmentVariables( fileContent ) );
	} else if ( extension === '.js' ) {
		config = require( path.resolve( filePath ) );
	} else if ( extension === '.json' ) {
		config = JSON.parse( replaceEnvironmentVariables( fileContent ) );
	} else {
		throw new Error( extension + ' is not supported as configuration file' );
	}

	return config;
}

/**
 * Loads a config file without having to initialise it. Useful for one
 * off operations such as generating a hash via cli
 *
 * @param {Object|String} args commander arguments or path to config
 *
 * @public
 * @returns {Object} config deepstream configuration object
 */
module.exports.loadConfigWithoutInitialisation = function( filePath, /* test only */ args ) {
	var argv = args || global.deepstreamCLI || {};
	var configPath = setGlobalConfigDirectory( argv, filePath );
	var configString = fs.readFileSync( configPath, { encoding: 'utf8' } );
	var rawConfig = parseFile( configPath, configString );
	var config = extendConfig( rawConfig, argv );
	setGlobalLibDirectory( argv, config );
	return {
		config: config,
		configPath: configPath
	};
};

/**
 * Loads a file as deepstream config. CLI args have highest priority after the
 * configuration file. If some properties are not set they will be defaulted
 * to default values defined in the defaultOptions.js file.
 * Configuraiton file will be transformed to a deepstream object by evaluating
 * some properties like the plugins (logger and connectors).
 *
 * @param {Object|String} args commander arguments or path to config
 *
 * @public
 * @returns {Object} config deepstream configuration object
 */
module.exports.loadConfig = function( filePath, /* test only */ args ) {
	const config = exports.loadConfigWithoutInitialisation( filePath, args );
	return {
		config: configInitialiser.initialise( config.config ),
		file: config.configPath
	};
};

/**
* Set the globalConfig prefix that will be used as the directory for ssl, permissions and auth
* relative files within the config file
*/
function setGlobalConfigDirectory( argv, filePath ) {
	var customConfigPath =
			argv.c ||
			argv.config ||
			filePath ||
			process.env.DEEPSTREAM_CONFIG_DIRECTORY;
	var configPath = customConfigPath ? verifyCustomConfigPath( customConfigPath ) : getDefaultConfigPath();
	global.deepstreamConfDir = path.dirname( configPath );
	return configPath;
}

/**
* Set the globalLib prefix that will be used as the directory for the logger
* and plugins within the config file
*/
function setGlobalLibDirectory( argv, config ) {
	var libDir =
			argv.l ||
			argv.libDir ||
			( config.libDir && fileUtils.lookupConfRequirePath( config.libDir ) ) ||
			process.env.DEEPSTREAM_LIBRARY_DIRECTORY;
	global.deepstreamLibDir = libDir;
}

/**
 * Augments the basic configuration with command line parameters
 * and normalizes paths within it
 *
 * @param   {Object} config    configuration
 * @param   {Object} argv      command line arguments
 * @param   {String} configDir config directory
 *
 * @private
 * @returns {Object} extended config
 */
function extendConfig( config, argv ) {
	var cliArgs = {};
	var key;

	for ( key in defaultOptions.get() ) {
		cliArgs[key] = typeof argv[key] === 'undefined' ? undefined : argv[key];
	}

	return utils.merge( { plugins: {} }, defaultOptions.get(), config, cliArgs );
}

/**
 * Checks if a config file is present at a given path
 *
 * @param   {String} configPath the path to the config file
 *
 * @private
 * @returns {String} verified path
 */
function verifyCustomConfigPath( configPath ) {
	if( fileUtils.fileExistsSync( configPath ) ) {
		return configPath;
	} else {
		throw new Error( 'Configuration file not found at: ' + configPath );
	}
}

/**
 * Fallback if no config path is specified. Will attempt to load the file from the default directory
 *
 * @private
 * @returns {String} filePath
 */
function getDefaultConfigPath() {
	var filePath, i, k;

	for( k = 0; k < DEFAULT_CONFIG_DIRS.length; k++ ) {
		for( i = 0; i < SUPPORTED_EXTENSIONS.length; i++ ) {
			filePath = DEFAULT_CONFIG_DIRS[ k ] + SUPPORTED_EXTENSIONS[ i ];
			if( fileUtils.fileExistsSync( filePath ) ) {
				return filePath;
			}
		}
	}

	throw new Error( 'No config file found' );
}

/**
 * Handle the introduction of global enviroment variables within
 * the yml file, allowing value substitution.
 *
 * For example:
 * ```
 * host: $HOST_NAME
 * port: $HOST_PORT
 * ```
 *
 * @param {String} fileContent The loaded yml file
 *
 * @private
 * @returns {void}
 */
function replaceEnvironmentVariables( fileContent ) {
	var environmentVariable = new RegExp( /\${([^\}]+)}/g );
	fileContent = fileContent.replace( environmentVariable, ( a, b ) => {
		return process.env[ b ] || b;
	} );
	return fileContent;
}
