'use strict';

const colors = require( 'colors' );
const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );

const DEFAULT_PID_FILE = path.join( os.tmpDir(), 'deepstream.pid' );
const PID_FILE = process.env.PID_FILE || DEFAULT_PID_FILE;

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

const ensureNotRunning = function( callback ) {
	read( function( err, data ) {
		if ( err ) {
			if ( err.code  === 'ENOENT' ) {
				return callback();
			}
			return exit( err );
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
			return exit( err );
		}
	} );
};

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

const isRunning = function( pid ) {
	try {
		return process.kill( pid, 0 );
	} catch( e ) {
		return e.code === 'EPERM';
	}
};

const remove = function( callback ) {
	if ( callback == null ) {
		callback = function() {};
	}
	fs.unlink( PID_FILE, function( err ) {
		callback ( err );
	} );
};

const stop = function() {
	read( function( err, data ) {
		if ( err ) {
			return console.log( 'no pid file' );
		} else {
			try {
				process.kill( data.pid );
			} catch ( err ) {
				return console.log( 'no proccess found for PID ' + data.pid );
			}
			const uptime = new Date().getTime() - data.timestamp;
			console.log( 'deepstream was running for ' + uptime / 1000 + ' secconds' );
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
