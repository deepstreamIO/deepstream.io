var AuthenticationHandler = require( '../../src/authentication/http-authentication-handler' );
var TestHttpServer = require( '../test-helper/test-http-server' );

describe( 'it forwards authentication attempts as http post requests to a specified endpoint', function(){
	var authenticationHandler;
	var server;
	var port = TestHttpServer.getRandomPort();

	beforeAll(function( done ){
		server = new TestHttpServer( port, done );
	});

	afterAll( function( done ){
		server.close( done );
	});

	it( 'creates the authentication handler', function(){
		authenticationHandler = new AuthenticationHandler({ endpointUrl: 'http://localhost:' + port });
	});

	it( 'issues a request when isValidUser is called', function( done ){
		var connectionData = { 'connection': 'data' };
		var authData = { 'username': 'userA' };
		console.time( 'isValid' );
		server.once( 'request-received', function(){
			expect( server.lastRequestData ).toEqual({
				connectionData: { 'connection': 'data' },
				authData: { 'username': 'userA' }
			});
			expect( server.lastRequestHeaders[ 'content-type' ] ).toBe( 'application/json' );
			server.respondWith( 200, { 'extra': 'data' } );
		});
		authenticationHandler.isValidUser( connectionData, authData, function( err, result, authData ){
			expect( err ).toBe( null );
			expect( result ).toBe( true );
			expect( authData ).toEqual( { 'extra': 'data' } );
			console.timeEnd( 'isValid' );
			done();
		});
	});
});