'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const yaml = require( 'js-yaml' );
const defaultOptions = require( '../default-options' );
const utils = require( './utils' );
const configInitialiser = require( './config-initialiser' );

const SUPPORTED_EXTENSIONS = [ '.yml', '.json', '.js' ];
var commandLineArguments = require( 'minimist' )( process.argv.slice( 2 ) );

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
	var config = extendConfig( rawConfig, argv, path.dirname( configPath ) );

	return {
		config: configInitialiser.initialise( config, argv ),
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

function extendConfig( config, argv, configDir ) {
	var cliArgs = {};
	var key;

	for ( key in defaultOptions.get() ) {
		cliArgs[key] = argv[key] || undefined;
	}

	if( config.auth && config.auth.options && config.auth.options.path ) {
		config.auth.options.path = utils.normalisePath( config.auth.options.path, configDir );
	}

	if( config.permission && config.permission.options && config.permission.options.path ) {
		config.permission.options.path = utils.normalisePath( config.permission.options.path, configDir );
	}

	return utils.merge( { plugins: {} }, defaultOptions.get(), config, cliArgs );
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