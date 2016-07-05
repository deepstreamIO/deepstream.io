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
		.option( '-d, --detach', 'detach the deepstream server process' )

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

	if ( this.detach ) {
		// --detach is not supported for windows
		if ( os.platform() === 'win32' ) {
			console.error( 'detached mode not supported on windows' );
			process.exit( 1 );
		}
		// proxy arguments from commander to the spawing process
		const args = [];
		if ( this.config != null ) {
			args.push( '--config' );
			args.push( this.config );
		}
		if ( this.libDir != null ) {
			args.push( '--lib-dir' );
			args.push( this.libDir );
		}
		// TODO: need to pass other options as well, which are accessable directly as properties of this
		//       but need to transform camelCase back to kebabCase, like tcpPort

		// ensure there is no pid file with a running process
		pidHelper.ensureNotRunning( function( err ) {
			if ( err ) {
				return pidHelper.exit( err );
			}
			const child = child_process.spawn( path.join(__dirname, 'deepstream') , ['start'].concat( args ), {
				detached: true,
				stdio: [ 'ignore']
			} );
			const WAIT_FOR_ERRORS = 3000;
			// register handler if the child process will fail within WAIT_FOR_ERRORS period
			child.on( 'close', detachErrorHandler );
			child.on( 'exit', detachErrorHandler );
			child.unref();
			// wait, maybe ther is an error during startup
			setTimeout( function() {
				console.log( 'process was detached with pid ' + child.pid );
				process.exit( 0 );
			}, WAIT_FOR_ERRORS );
		} );
	} else {
		// non-detach casee
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
}

function detachErrorHandler() {
	console.error( 'Error during detaching the deepstream process, see logs or run without --detach'.red );
	process.exit( 1 );
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
