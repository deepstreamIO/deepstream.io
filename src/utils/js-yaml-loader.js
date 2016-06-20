'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const yaml = require( 'js-yaml' );
const defaultOptions = require( '../default-options' );
const utils = require( './utils' );
const configInitialiser = require( './config-initialiser' );
const SUPPORTED_EXTENSIONS = [ '.yml', '.json', '.js' ];

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
 * Loads a file as deepstream config. CLI args have highest priority after the
 * configuration file. If some properties are not set they will be defaulted
 * to default values defined in the defaultOptions.js file.
 * Configuraiton file will be transformed to a deepstream object by evaluating
 * some properties like the plugins (logger and connectors).
 *
 * @param {Object} args commander arguments
 *
 * @public
 * @returns {Object} config deepstream configuration object
 */
module.exports.loadConfig = function( args ) {
	var argv = args || process.deepstreamCLI || {};
	var customConfigPath = argv.c || argv.config;
	var configPath = customConfigPath ? verifyCustomConfigPath( customConfigPath ) : getDefaultConfigPath();
	var configString = fs.readFileSync( configPath, { encoding: 'utf8' } );
	var rawConfig = parseFile( configPath, configString );
	var config = extendConfig( rawConfig, argv, path.dirname( configPath ) );

	return {
		config: configInitialiser.initialise( config, argv ),
		file: configPath
	};
};


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
function extendConfig( config, argv, configDir ) {
	var cliArgs = {};
	var key;

	for ( key in defaultOptions.get() ) {
		cliArgs[key] = typeof argv[key] === 'undefined' ? undefined : argv[key];
	}

	if( config.auth && config.auth.options && config.auth.options.path ) {
		config.auth.options.path = utils.lookupRequirePath( config.auth.options.path, configDir );
	}

	if( config.permission && config.permission.options && config.permission.options.path ) {
		config.permission.options.path = utils.lookupRequirePath( config.permission.options.path, configDir );
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
	if( fileExistsSync( configPath ) ) {
		return configPath;
	} else {
		throw new Error( 'configuration file not found at: ' + configPath );
	}
}

/**
 * Fallback if no config path is specified. Will attempt to load the file from the default directory
 *
 * @private
 * @returns {String} filePath
 */
function getDefaultConfigPath() {
	var defaultConfigBaseName = path.join( 'conf', 'config' );
	var filePath, i;

	for( i = 0; i < SUPPORTED_EXTENSIONS.length; i++ ) {
		filePath = defaultConfigBaseName + SUPPORTED_EXTENSIONS[ i ];

		if( fileExistsSync( filePath ) ) {
			return filePath;
		}
	}

	throw new Error( 'No config file found' );
}

/**
 * Returns true if a file exists for a given path
 *
 * @param   {String} path
 *
 * @private
 * @returns {Boolean} exists
 */

function fileExistsSync( path ) {
	try{
		fs.lstatSync( path );
		return true;
	} catch( e ) {
		return false;
	}
}

/**
 * Handle the introduction of global enviroment variables within
 * the yaml file, allowing value substitution.
 *
 * For example:
 * ```
 * host: $HOST_NAME
 * port: $HOST_PORT
 * ```
 *
 * @param {String} fileContent The loaded yaml file
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
