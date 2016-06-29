'use strict';

const colors = require( 'colors' );
const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );

const DEFAULT_PID_FILE = path.join( os.tmpDir(), 'deepstream.pid' );
const PID_FILE = process.env.DEEPSTREAM_PID_FILE || DEFAULT_PID_FILE;

/**
 * Save a JSON (pid and timestamp) object to the temp directofy of the system
 *
 * @param  {String|Number} pid Connector type: {cache|message|storage}
 * @callback callback
 * @param {error} error
 * @return {void}
 */
const save = function( pid, callback ) {
	if ( callback == null ) {
		callback = function() {};
	}
	if ( pid == null ) {
		return callback( new Error( 'pid is null' ) );
	}
	const now = new Date();
	const data = {
		pid: pid,
		timestamp: now.getTime(),
		time: now.toString()
	};
	fs.writeFile( PID_FILE , JSON.stringify( data ), function( err ) {
		callback( err );
	} );
};

/**
 * Try to read the pid file from the temp directory
 *
 * @callback callback
 * @param {error} error
 * @return {void}
 */
const read = function( callback ) {
	fs.readFile( PID_FILE, 'utf8', function( err, content ) {
		if ( err ) {
			return callback( err );
		}
		try {
			return callback( null, JSON.parse( content ) );
		} catch ( err ) {
			return callback( err );
		}
	} );
};

/**
 * Ensure that there is no process running with the PID in the pid file,
 * otherwise throw an error.
 *
 * @callback callback
 * @param {error} error
 * @return {void}
 */
const ensureNotRunning = function( callback ) {
	read( function( err, data ) {
		if ( err ) {
			if ( err.code  === 'ENOENT' ) {
				return callback();
			}
			return callback( err );
		}
		try {
			const pid = data.pid;
			if ( isRunning( pid ) ) {
				throw new Error( 'A deepstream server is already running with PID ' + pid + ', see ' + PID_FILE );
			} else {
				// pid file is there but process is not running anymore
				return callback();
			}
		} catch ( err ) {
			return callback( err );
		}
	} );
};

/**
 * Exit the current process with a status code 0.
 * If you pass an error as argument, it will exit with 1 and the error will
 * printed to the stderr.
 *
 * @param  {Error} err Optional error object
 * @return {void}
 */
const exit = function( err ) {
	if ( err instanceof Error ) {
		console.error ( colors.red( err.toString() ) );
		process.exit( 1 );
	} else {
		remove( function() {
			process.exit( 0 );
		} );
	}
};

/**
 * Try to find a process with the given pid and returns true if it is running.
 * Otherwise false.
 *
 * @param  {String|Number} pid
 * @return {Boolean}
 */
const isRunning = function( pid ) {
	try {
		return process.kill( pid, 0 );
	} catch( e ) {
		return e.code === 'EPERM';
	}
};

/**
 * Delete the pid file
 *
 * @callback callback Optional callback
 * @param {error} error
 * @return {void}
 */
const remove = function( callback ) {
	fs.unlink( PID_FILE, function( err ) {
		if ( callback != null ) {
			return callback ( err );
		}
		console.error( err );
	} );
};

/**
 * Try to find a process from the pid file and kills it.
 * Prints out if a process or pid file was found or not for how long it was running.
 *
 * @return {void}
 */
const stop = function() {
	read( function( err, data ) {
		if ( err ) {
			return console.log( 'no pid file' );
		} else {
			try {
				process.kill( data.pid );
			} catch ( err ) {
				return console.log( 'No process found for PID ' + data.pid );
			}
			const uptime = new Date().getTime() - data.timestamp;
			console.log( 'Deepstream was running for ' + uptime / 1000 + ' seconds' );
		}
	} );
};

module.exports = {
	save: save,
	isRunning: isRunning,
	ensureNotRunning: ensureNotRunning,
	exit: exit,
	stop: stop,
	read: read,
	PID_FILE: PID_FILE
};
