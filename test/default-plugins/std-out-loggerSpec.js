var Logger = require( '../../src/default-plugins/std-out-logger' );
var C = require( '../../src/constants/constants' );

describe( 'logs to stdout and stderr', function(){
	var logger = new Logger( { color: false } );
	var originalStdOut = process.stdout;
	var originalStdErr = process.stderr;
	var stdout = jasmine.createSpy( 'stdout' );
	var stderr = jasmine.createSpy( 'stderr' );
	var comp = function( std, exp ) {
		return std.calls.mostRecent().args[ 0 ].indexOf( exp ) !== -1;
	};

	beforeAll(function(){
		Object.defineProperty(process, 'stdout', {
			value: { write: stdout }
		});
		Object.defineProperty(process, 'stderr', {
			value: { write: stderr }
		});
	});

	afterAll(function(){
		Object.defineProperty(process, 'stdout', {
			value: originalStdOut
		});
		Object.defineProperty(process, 'stderr', {
			value: originalStdErr
		});
	});

	it( 'creates the logger', function(){
		expect( logger.isReady ).toBe( true );
		logger.log( C.LOG_LEVEL.INFO, 'a', 'b' );
		expect( comp( stdout, 'a | b' ) ).toBe( true );
	});

	it( 'logs to stderr', function(){
		stdout.calls.reset();
		stderr.calls.reset();
		logger.log( C.LOG_LEVEL.ERROR, 'd', 'e' );
		expect( stdout.calls.count() ).toBe( 0 );
		expect( stderr.calls.count() ).toBe( 1 );
	});

	it( 'logs above log level', function(){
		logger.setLogLevel( C.LOG_LEVEL.DEBUG );
		stdout.calls.reset();
		logger.log( C.LOG_LEVEL.INFO, 'd', 'e' );
		expect( stdout.calls.count() ).toBe( 1 );
		logger.setLogLevel( C.LOG_LEVEL.WARN );
		stdout.calls.reset();
		logger.log( C.LOG_LEVEL.INFO, 'd', 'e' );
		expect( stdout.calls.count() ).toBe( 0 );
	});
});