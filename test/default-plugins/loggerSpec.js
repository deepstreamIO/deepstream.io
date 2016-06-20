'use strict';

/* globals jasmine, describe, expect, beforeEach,afterEach, it */

const colors = require( 'colors' );
const Logger = require( '../../src/default-plugins/logger' );
const C = require( '../../src/constants/constants' );

describe( 'logs to stdout and stderr', function() {
	const originalStdOut = process.stdout;
	const originalStdErr = process.stderr;
	const stdout = jasmine.createSpy( 'stdout' );
	const stderr = jasmine.createSpy( 'stderr' );
	const comp = function( std, exp ) {
		return std.calls.mostRecent().args[ 0 ].indexOf( exp ) !== -1;
	};

	let logger;
	beforeEach( function() {
		logger = new Logger( {colorize: false} );
		Object.defineProperty( process, 'stdout', {
			value: { write: stdout }
		} );
		Object.defineProperty( process, 'stderr', {
			value: { write: stderr }
		} );
	} );

	afterEach( function() {
		Object.defineProperty( process, 'stdout', {
			value: originalStdOut
		} );
		Object.defineProperty( process, 'stderr', {
			value: originalStdErr
		} );
	} );

	it( 'creates the logger', function() {
		expect( logger.isReady ).toBe( true );
		logger.log( C.LOG_LEVEL.INFO, 'a', 'b' );
		expect( comp( stdout, 'a | b' ) ).toBe( true );
	} );

	it( 'logs to stderr', function() {
		stdout.calls.reset();
		stderr.calls.reset();
		logger.log( C.LOG_LEVEL.ERROR, 'd', 'e' );
		expect( stdout.calls.count() ).toBe( 0 );
		expect( stderr.calls.count() ).toBe( 1 );
	} );

	it( 'logs above log level', function() {
		logger.setLogLevel( C.LOG_LEVEL.DEBUG );
		logger._$useColors = false;
		stdout.calls.reset();
		logger.log( C.LOG_LEVEL.INFO, 'd', 'e' );
		expect( stdout.calls.count() ).toBe( 1 );
		logger.setLogLevel( C.LOG_LEVEL.WARN );
		stdout.calls.reset();
		logger.log( C.LOG_LEVEL.INFO, 'd', 'e' );
		expect( stdout.calls.count() ).toBe( 0 );
	} );

	it( 'logs with colors as default', function() {
		logger = new Logger();
		logger.log( C.LOG_LEVEL.INFO, 'a', 'b' );
		expect( stdout.calls.allArgs()[0][0].trim() ).toEqual( colors.green( 'a | b' ) );
	} );
} );

describe( 'multiple transports', function() {

	const config = {
		type: 'default',
		options: [
			{
				type: 'console',
				options: {
					colorize: false,
					level: 'info'
				}
			}, {
				type: 'file',
				options: {
					filename: 'logs.json',
					level: 'debug'
				}
			}, {
				type: 'time',
				options: {
					level: 'warn',
					datePattern: '.yyyy-MM-dd-HH-mm',
					filename: 'time-roated-logfile'
				}
			}
		]
	};
	it( 'create console, file and rotation transports', function() {
		const logger = new Logger( config );
		expect( logger._transports.length ).toEqual( 3 );
		expect( logger._transports[0].name ).toEqual( 'console' );
		expect( logger._transports[0].level ).toEqual( 'info' );
		expect( logger._transports[0].colorize ).toEqual( false );
		expect( logger._transports[1].name ).toEqual( 'file' );
		expect( logger._transports[1].level ).toEqual( 'debug' );
		expect( logger._transports[1].filename ).toEqual( 'logs.json' );
		expect( logger._transports[2].name ).toEqual( 'dailyRotateFile' );
		expect( logger._transports[2].level ).toEqual( 'warn' );
		expect( logger._transports[2].filename ).toEqual( 'time-roated-logfile' );
		expect( logger._transports[2].datePattern ).toEqual( '.yyyy-MM-dd-HH-mm' );
	} );

	it( 'creating an unsupported transport throws an error', function( next ) {
		try {
			new Logger( {
				type: 'default',
				options: [ {
					type: 'not-supported-transport-type'
				}]
			} );
			next.fail( 'should throw an error' );
		} catch ( err ) {
			expect( err.toString() ).toContain( 'not-supported-transport-type' );
			next();
		}
	} );

	it( 'creating a file transport throws an error without a filename', function( next ) {
		try {
			new Logger( {
				type: 'default',
				options: [ {
					type: 'file'
				}]
			} );
			next.fail( 'should throw an error' );
		} catch ( err ) {
			expect( err.toString() ).toContain( 'filename' );
			next();
		}
	}	);

	it( 'creating a time(rotation) transport throws an error without a filename', function( next ) {
		try {
			new Logger( {
				type: 'default',
				options: [ {
					type: 'time'
				}]
			} );
			next.fail( 'should throw an error' );
		} catch ( err ) {
			expect( err.toString() ).toContain( 'filename' );
			next();
		}
	}	);

} );
