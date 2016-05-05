var Deepstream = require( '../src/deepstream.io' );
var ClosableLogger = require( './mocks/closable-logger' );

describe( 'the main server class', function(){
	it( 'exposes the message parser\'s convertTyped method', function(){
		var server = new Deepstream();
		expect( server.convertTyped( 'N42' ) ).toBe( 42 );
	});

	it( 'exposes constants as a static', function(){
		expect( Deepstream.constants ).toBeDefined( );
	});

	it( 'sets a supported option', function(){
		var server = new Deepstream();
		expect(function(){
			server.set( 'port', 4444 );
		}).not.toThrow();
	});

	it( 'sets an unsupported option', function(){
		var server = new Deepstream();
		expect(function(){
			server.set( 'gibberish', 4444 );
		}).toThrow();
	});
});

describe( 'it starts and stops the server', function(){
	var server;

	it( 'starts the server', function( next ){
		server = new Deepstream();
		server.on( 'started', next );
		expect( server.isRunning ).toBe( false );
		server.start();
	});

	it( 'stops the server', function( next ){
		expect( server.isRunning ).toBe( true );
		server.on( 'stopped', next );
		server.stop();
	});

	it( 'has stopped the server', function(){
		expect( server.isRunning ).toBe( false );
	});
});

describe( 'it starts and stops a configured server', function(){
	var server;
	var logger;

	it( 'configures the server', function(){
		server = new Deepstream();
		logger = new ClosableLogger();
		server.set( 'dataTransforms', []);
		server.set( 'showLogo', false );
		server.set( 'logger', logger );
	});

	it( 'starts the server', function( next ){
		server.on( 'started', next );
		expect( server.isRunning ).toBe( false );
		server.start();
	});

	it( 'encounters a plugin error', function(){
		expect( logger.log.calls.mostRecent().args[ 2 ] ).toBe( 'Deepstream started' );
		logger.emit( 'error', 'test error' );
		expect( logger.log.calls.mostRecent().args[ 2 ] ).toBe( 'Error from logger plugin: test error' );
	});

	it( 'stops the server', function( next ){
		expect( server.isRunning ).toBe( true );
		server.on( 'stopped', next );
		server.stop();
	});

	it( 'has stopped the server', function(){
		expect( server.isRunning ).toBe( false );
	});
});