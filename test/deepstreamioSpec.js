/* global jasmine, beforeAll, afterAll, expect, describe, it */
var child_process = require( 'child_process' );
var path = require( 'path' );
var Deepstream = require( '../src/deepstream.io' );
var ClosableLogger = require( './mocks/closable-logger' );
var LoggerMock = require( './mocks/logger-mock' );

describe( 'the main server class', function() {
	it( 'exposes the message parser\'s convertTyped method', function() {
		var server = new Deepstream();
		expect( server.convertTyped( 'N42' ) ).toBe( 42 );
	} );

	it( 'exposes constants as a static', function() {
		expect( Deepstream.constants ).toBeDefined( );
	} );

	it( 'sets a supported option', function() {
		var server = new Deepstream();
		expect(function() {
			server.set( 'port', 4444 );
		} ).not.toThrow();
	} );

	it( 'sets an unsupported option', function() {
		var server = new Deepstream();
		expect( function() {
			server.set( 'gibberish', 4444 );
		} ).toThrow();
	} );
} );

describe( 'it starts and stops the server', function() {
	var server;

	it( 'starts the server twice', function( next ) {
		server = new Deepstream( {showLogo: false}  );
		server.set( 'logger', new LoggerMock() );
		server.on( 'started', function() {
			try {
				server.start();
				next.fail( 'should fail to start deepstream twice' );
			} catch ( err ) {
				expect( err.toString() ).toContain( 'can only start after it stops succesfully' );
				next();
			}
		} );
		expect( server.isRunning() ).toBe( false );
		server.start();
	} );

	//NOTE: depends on test before
	it( 'stops the server', function( next ) {
		expect( server.isRunning() ).toBe( true );
		server.on( 'stopped', function() {
			expect( server.isRunning() ).toBe( false );
			try {
				server.stop();
				next.fail( 'should fail to stop deepstream twice' );
			} catch ( err ) {
				expect( err.toString() ).toContain( 'only be stopped after it starts succesfully' );
				next();
			}
		} );
		server.stop();
	} );

	//NOTE: depends on the test before
	it( 'start the server again from the same instance', function( next ) {
		server.on( 'started', server.stop );
		server.on( 'stopped', next );
		server.start();
	} );
} );

describe( 'it handle calling start and stop twice', function() {
	var server;

	it( 'starts the server', function( next ) {
		server = new Deepstream( {showLogo: false} );
		server.set( 'logger', new LoggerMock() );
		server.on( 'started', next );
		expect( server.isRunning() ).toBe( false );
		server.start();
	} );

	it( 'stops the server', function( next ) {
		expect( server.isRunning() ).toBe( true );
		server.on( 'stopped', next );
		server.stop();
	} );

	it( 'has stopped the server', function() {
		expect( server.isRunning() ).toBe( false );
	} );
} );

describe( 'it starts and stops a configured server', function() {
	var server;
	var logger;

	beforeEach( function() {
		server = new Deepstream();
		logger = new ClosableLogger();
		server.set( 'dataTransforms', [] );
		server.set( 'showLogo', false );
		server.set( 'logger', logger );
	} );

	afterEach( function( next ) {
		if ( server.isRunning() ) {
			server.on( 'stopped', next );
			server.stop();
		} else {
			next();
		}
	} );

	it( 'starts and stops the server', function( next ) {
		expect( server.isRunning() ).toBe( false );
		server.on( 'started', function() {
			expect( server.isRunning() ).toBe( true );
			server.on( 'stopped', function() {
				expect( server.isRunning() ).toBe( false );
				next();
			} );
			server.stop();
		} );
		server.start();
	} );

	it( 'encounters a logger error', function( next ) {
		server.on( 'started', function() {
			server._options.logger.emit( 'error', 'test error' );
			expect( logger.log.calls.mostRecent().args[ 2 ] ).toBe( 'Error from logger plugin: test error' );
			next();
		} );
		server.start();
	} );
	it( 'encounters a plugin error', function( next ) {
		var fakeCloseablePlugin = new  ClosableLogger();
		server.set( 'cache', fakeCloseablePlugin );
		server.on( 'started', function() {
			fakeCloseablePlugin.emit( 'error', 'test error' );
			//TODO: why fakeCloseablePlugin contains console args?
			expect( logger.log.calls.mostRecent().args[ 2 ] ).toBe( 'Error from cache plugin: test error' );
			expect( fakeCloseablePlugin.log.calls.mostRecent().args[ 2 ] ).toBe( 'Error from cache plugin: test error' );
			next();
		} );
		server.start();
	} );

	it( 'should merge the options with default values', function( next ) {
		server = new Deepstream( {showLogo: false, permission: {type: 'none'}} );
		server.set( 'logger', logger );
		server.on( 'started', function() {
			expect( server.isRunning() ).toBe( true );
			next();
		} );
		server.start();
	} );

} );

describe( 'handle server startup without config file', function() {
	var cwd = path.resolve( './bin' );
	var execOptions =  {
		cwd: cwd,
		stdio: ['ignore', 'ignore', 'pipe']
	};
	it( 'via CLI', function( done ) {
		try {
			child_process.execSync( 'node deepstream start', execOptions );
		} catch ( err ) {
			var stderr = err.stderr.toString();
			expect( stderr ).toContain( 'No config file found' );
			done();
		}
	} );
	it( 'via API', function( done ) {
		var server = new Deepstream();
		var logger = new ClosableLogger();
		server.set( 'dataTransforms', [] );
		server.set( 'showLogo', false );
		server.set( 'logger', logger );
		server._configFile = null;
		server.on( 'stopped', done );
		server.on( 'started', server.stop );
		server.start();
	} );

} );
