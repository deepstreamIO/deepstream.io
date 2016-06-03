'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const yaml = require( 'js-yaml' );
const defaultOptions = require( '../default-options' );
const utils = require( './utils' );
const C = require( '../constants/constants' );
const argv = require( 'minimist' )( process.argv.slice( 2 ) );
const LOG_LEVEL_KEYS = Object.keys( C.LOG_LEVEL );

function readAndParseFile( filePath, callback ) {
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
}

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

function loadConfig( customFilePath ) {
	const filePath = findFilePath( customFilePath );
	if ( filePath == null ) {
		return {
			config: defaultOptions.get(),
			file: 'default options'
		};
	}
	const config = parseFile( filePath );
	// CLI arguments
	var cliArgs = {};
	for ( let key in Object.keys( defaultOptions.get() ) ) {
		cliArgs[key] = argv[key] || undefined;
	}

	return {
		config: utils.merge( {}, defaultOptions.get(), handleMagicProperties( config ), cliArgs ),
		file: filePath
	};
}

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

function handleMagicProperties( cfg ) {
	const config = utils.merge( {
		plugins: {}
	}, cfg );

	handleUUIDProperty( config );
	handleLogLevel( config );
	handlePlugins( config );

	return config;
}

function handleUUIDProperty( config ) {
	if ( config.serverName === 'UUID' ) {
		config.serverName = utils.getUid();
	}
}

function handleLogLevel( config ) {
	if ( LOG_LEVEL_KEYS.indexOf( config.logLevel ) !== -1 ) {
		config.logLevel = C.LOG_LEVEL[ config.logLevel ];
	}
}

function handlePlugins( config ) {
	var plugins = {
		logger: config.plugins.logger,
		messageConnector: config.plugins.message,
		cache: config.plugins.cache,
		storage: config.plugins.storage
	};
	for ( let key in plugins ) {
		var plugin = plugins[key];
		if ( plugin != null ) {
			var requirePath = plugin.path[ 0 ] !== '.' ?
				plugin.path : path.join( process.cwd(), plugin.path );
			var fn = require( requirePath );
			if ( key === 'logger' ) {
				config[key] = fn;
			} else {
				config[key] = new fn( plugin.options );
			}
		}
	}
}

module.exports = {
	async: readAndParseFile,
	loadConfig: loadConfig
};
