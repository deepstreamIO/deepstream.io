var AuthenticationHandler = require( '../../src/authentication/http-authentication-handler' );
var TestHttpServer = require( '../test-helper/test-http-server' );

describe( 'it forwards authentication attempts as http post requests to a specified endpoint', function(){
	var authenticationHandler;
	var server;
	var port = TestHttpServer.getRandomPort();
	var logger = { log: jasmine.createSpy( 'log' ) };

	beforeAll(function( done ){
		server = new TestHttpServer( port, done );
	});

	afterAll( function( done ){
		server.close( done );
	});

	it( 'creates the authentication handler', function(){
		var endpointUrl = 'http://localhost:' + port;

		authenticationHandler = new AuthenticationHandler({
			endpointUrl: endpointUrl,
			permittedStatusCodes: [ 200 ],
			requestTimeout: 60,
			logger: logger
		});
		expect( authenticationHandler.type ).toBe( 'http webhook to ' + endpointUrl );
	});

	it( 'issues a request when isValidUser is called and receives 200 in return', function( done ){
		var connectionData = { 'connection': 'data' };
		var authData = { 'username': 'userA' };

		server.once( 'request-received', function(){
			expect( server.lastRequestData ).toEqual({
				connectionData: { 'connection': 'data' },
				authData: { 'username': 'userA' }
			});
			expect( server.lastRequestMethod ).toBe( 'POST' );
			expect( server.lastRequestHeaders[ 'content-type' ] ).toContain( 'application/json' );
			server.respondWith( 200, { authData: { 'extra': 'data' } } );
		});

		authenticationHandler.isValidUser( connectionData, authData, function( result, data ){
			expect( result ).toBe( true );
			expect( data ).toEqual( { authData: { 'extra': 'data' } } );
			done();
		});
	});

	it( 'issues a request when isValidUser is called and receives 401 (denied) in return', function( done ){
		var connectionData = { 'connection': 'data' };
		var authData = { 'username': 'userA' };

		server.once( 'request-received', function(){
			expect( server.lastRequestData ).toEqual({
				connectionData: { 'connection': 'data' },
				authData: { 'username': 'userA' }
			});
			expect( server.lastRequestMethod ).toBe( 'POST' );
			expect( server.lastRequestHeaders[ 'content-type' ] ).toContain( 'application/json' );
			server.respondWith( 401 );
		});

		authenticationHandler.isValidUser( connectionData, authData, function( result, data ){
			expect( result ).toBe( false );
			expect( data ).toBe( null );
			expect( logger.log.calls.count() ).toBe( 0 );
			done();
		});
	});

	it( 'receives a positive response without data', function( done ){
		var connectionData = { 'connection': 'data' };
		var authData = { 'username': 'userA' };

		server.once( 'request-received', function(){
			expect( server.lastRequestData ).toEqual({
				connectionData: { 'connection': 'data' },
				authData: { 'username': 'userA' }
			});
			expect( server.lastRequestMethod ).toBe( 'POST' );
			expect( server.lastRequestHeaders[ 'content-type' ] ).toContain( 'application/json' );
			server.respondWith( 200, '' );
		});

		authenticationHandler.isValidUser( connectionData, authData, function( result, data ){
			expect( result ).toBe( true );
			expect( data ).toBe( null );
			done();
		});
	});

	it( 'receives a positive response with only a string', function( done ){
		var connectionData = { 'connection': 'data' };
		var authData = { 'username': 'userA' };

		server.once( 'request-received', function(){
			expect( server.lastRequestData ).toEqual({
				connectionData: { 'connection': 'data' },
				authData: { 'username': 'userA' }
			});
			expect( server.lastRequestMethod ).toBe( 'POST' );
			expect( server.lastRequestHeaders[ 'content-type' ] ).toContain( 'application/json' );
			server.respondWith( 200, 'userA' );
		});

		authenticationHandler.isValidUser( connectionData, authData, function( result, data ){
			expect( result ).toBe( true );
			expect( data ).toEqual({ username: 'userA' });
			done();
		});
	});

	it( 'receives a server error as response', function( done ){
		var connectionData = { 'connection': 'data' };
		var authData = { 'username': 'userA' };

		server.once( 'request-received', function(){
			server.respondWith( 500, 'oh dear' );
		});

		authenticationHandler.isValidUser( connectionData, authData, function( result, data ){
			expect( result ).toBe( false );
			expect( logger.log ).toHaveBeenCalledWith( 2, 'AUTH_ERROR',  'http auth server error: oh dear' );
			done();
		});
	});

	it( 'times out', function( done ){
		var connectionData = { 'connection': 'data' };
		var authData = { 'username': 'userA' };

		server.once( 'request-received', function(){
			//don't respond
		});

		logger.log.calls.reset();

		authenticationHandler.isValidUser( connectionData, authData, function( result, data ){
			expect( result ).toBe( false );
			expect( logger.log ).toHaveBeenCalledWith( 2, 'AUTH_ERROR', 'http auth error: Error: socket hang up' );
			server.respondWith( 200 );
			done();
		});
	});
});