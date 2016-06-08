/* global expect, describe, it */
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

	it( 'starts the server', function( next ) {
		server = new Deepstream();
		server.set( 'showLogo', false );
		server.set( 'logger', new LoggerMock() );
		server.on( 'started', next );
		expect( server.isRunning ).toBe( false );
		server.start();
	} );

	it( 'stops the server', function( next ) {
		expect( server.isRunning ).toBe( true );
		server.on( 'stopped', next );
		server.stop();
	} );

	it( 'has stopped the server', function() {
		expect( server.isRunning ).toBe( false );
	} );
} );

describe( 'it starts and stops a configured server', function() {
	var server;
	var logger;

	it( 'configures the server', function() {
		server = new Deepstream();
		logger = new ClosableLogger();
		server.set( 'dataTransforms', [] );
		server.set( 'showLogo', false );
		server.set( 'logger', logger );
	} );

	it( 'starts the server', function( next ) {
		server.on( 'started', next );
		expect( server.isRunning ).toBe( false );
		server.start();
	} );

	it( 'encounters a plugin error', function() {
		expect( logger.log.calls.mostRecent().args[ 2 ] ).toBe( 'Deepstream started' );
		logger.emit( 'error', 'test error' );
		expect( logger.log.calls.mostRecent().args[ 2 ] ).toBe( 'Error from logger plugin: test error' );
	} );

	it( 'stops the server', function( next ) {
		expect( server.isRunning ).toBe( true );
		server.on( 'stopped', next );
		server.stop();
	} );

	it( 'has stopped the server', function() {
		expect( server.isRunning ).toBe( false );
	} );

	it( 'fail starting the server with an empty options parameter', function() {
		server = new Deepstream( {} );
		expect( function() {
			server.start();
		} ).toThrow();
	} );

} );

// TODO: fix this on windows, it fails with warning: possible EventEmitter memory leak detected
xdescribe( 'handle server startup without config file', function() {
	it( 'TODO: fix on windows | via CLI', function( done ) {
		var cwd = path.resolve( './bin' );
		try {
			child_process.execSync( './deepstream', {
				cwd: cwd,
				stdio: ['ignore', 'ignore', 'pipe']
			} );
		} catch ( err ) {
			var stderr = err.stderr.toString();
			expect( stderr ).toContain( 'no such file or directory' );
			expect( stderr ).toContain( 'permissions.json' );
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
