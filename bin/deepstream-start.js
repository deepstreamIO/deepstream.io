'use strict';

const colors = require( 'colors' );
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const child_process = require( 'child_process' );
const C = require( '../src/constants/constants.js' );
const pidHelper = require( './pid-helper' );

module.exports = function( program ) {
	program
		.command( 'start' )
		.description( 'start a deepstream server' )

		.option( '-c, --config [file]', 'configuration file, parent directory will be used as prefix for other config files' )
		.option( '-l, --lib-dir [directory]', 'path where to lookup for plugins like connectors and logger' )

		.option( '--server-name <name>', 'Each server within a cluster needs a unique name' )
		.option( '--web-server-enabled [true|false]', 'Accept/Decline incoming HTTP connections', parseBoolean.bind( null, '--web-server-enabled' ) )
		.option( '--tcp-server-enabled [true|false]', 'Accept/Decline incoming TCP connections', parseBoolean.bind( null, '--tcp-server-enabled' ) )
		.option( '--host <host>', 'host for the HTTP/websocket server' )
		.option( '--port <port>', 'port for the HTTP/websocket server', parseInteger.bind( null, '--port' ) )
		.option( '--tcp-host <host>', 'host for the TCP server' )
		.option( '--tcp-port <port>', 'tcpHost', parseInteger.bind( null, '--tcp-port' ) )
		.option( '--disable-auth', 'Force deepstream to use "none" auth type' )
		.option( '--disable-permissions', 'Force deepstream to use "none" permissions' )
		.option( '--log-level <level>', 'Log messages with this level and above', parseLogLevel )
		.option( '--colors [true|false]', 'Enable or disable logging with colors', parseBoolean.bind( null, '--colors' ) )
		.action( action )
}

function action() {
	global.deepstreamCLI = this;
	const Deepstream = require( '../src/deepstream.io.js' );
	try {
		process.on( 'uncaughtException', pidHelper.exit );
		var ds = new Deepstream( null );
		ds.on( 'started', function() {
			pidHelper.save( process.pid );
		} );
		ds.start();
	} catch ( err ) {
		console.error( err.toString() );
		process.exit( 1 );
	}
	process.
		removeAllListeners( 'SIGINT' ).on( 'SIGINT', pidHelper.exit ).
		removeAllListeners( 'SIGTERM' ).on( 'SIGTERM', pidHelper.exit );
}

/**
* Used by commander to parse the log level and and fails if invalid
* value is passed in
* @private
*/
function parseLogLevel( logLevel ) {
	if( ! /debug|info|warn|error|off/i.test( logLevel ) ) {
		console.error( 'Log level must be one of the following (debug|info|warn|error|off)' );
		process.exit(1);
	}
	return logLevel.toUpperCase();
}

/**
* Used by commander to parse numbers and fails if invalid
* value is passed in
* @private
*/
function parseInteger( name, port ) {
	const portNumber = Number( port );
	if( !portNumber ) {
		console.error( `Provided ${name} must be an integer` );
		process.exit(1);
	}
	return portNumber;
}

/**
* Used by commander to parse boolean and fails if invalid
* value is passed in
* @private
*/
function parseBoolean( name, enabled ) {
	var isEnabled;
	if( typeof enabled === "undefined" || enabled === 'true' ) {
		isEnabled = true;
	}
	else if( typeof enabled !== "undefined" && enabled === 'false' ) {
		isEnabled = false;
	} else {
		console.error( `Invalid argument for ${name}, please provide true or false` );
		process.exit( 1 );
	}
	return isEnabled;
}
