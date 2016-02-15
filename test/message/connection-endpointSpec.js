var proxyquire = require( 'proxyquire' ).noCallThru(),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	HttpMock = require( '../mocks/http-mock' ),
	httpMock = new HttpMock(),
	httpsMock = new HttpMock(),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', { 'engine.io': engineIoMock, 'http': httpMock, 'https': httpsMock } ),
	_msg = require( '../test-helper/test-helper' ).msg,
	permissionHandlerMock = require( '../mocks/permission-handler-mock' ),
	lastAuthenticatedMessage = null,
	lastLoggedMessage = null,
	socketMock,
	options,
	connectionEndpoint;

options = {
	permissionHandler: require( '../mocks/permission-handler-mock' ),
	logger: { log: function( logLevel, event, msg ){ lastLoggedMessage = msg; } },
	maxAuthAttempts: 3,
	logInvalidAuthData: true,
	tcpServerEnabled: true,
	webServerEnabled: true
};

describe( 'connection endpoint', function() {

	it( 'create a connection endpoint', function() {
		permissionHandlerMock.reset();

		connectionEndpoint = new ConnectionEndpoint( options );
		connectionEndpoint.onMessage = function( socket, message ){
			lastAuthenticatedMessage = message;
		};
	});

	describe( 'the connection endpoint handles invalid auth messages', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'handles invalid auth messages', function(){
			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', 'gibberish' );

			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|INVALID_AUTH_MSG|invalid authentication message+' ) );
			expect( socketMock.isDisconnected ).toBe( true );
		});

		it( 'has discarded the invalid socket', function(){
			socketMock.lastSendMessage = null;
			socketMock.emit( 'message', 'some more gibberish' );
			expect( socketMock.lastSendMessage ).toBe( null );
		});
	});

	describe( 'the connection endpoint handles invalid json', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'handles invalid json messages', function(){
			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', _msg( 'A|REQ|{"a":"b}+' ) );

			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|INVALID_AUTH_MSG|invalid authentication message+' ) );
			expect( socketMock.isDisconnected ).toBe( true );
		});
	});

	describe( 'the connection endpoint routes valid auth messages to the permissionHandler', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'handles valid auth messages', function(){
			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );
			expect( permissionHandlerMock.lastUserValidationQueryArgs ).toBe( null );

			permissionHandlerMock.nextUserValidationResult = false;

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );

			expect( permissionHandlerMock.lastUserValidationQueryArgs.length ).toBe( 3 );
			expect( permissionHandlerMock.lastUserValidationQueryArgs[ 1 ].user ).toBe( 'wolfram' );
			expect( lastLoggedMessage.indexOf( 'wolfram' ) ).not.toBe( -1 );
			expect( socketMock.lastSendMessage ).toBe( _msg('A|E|INVALID_AUTH_DATA|Invalid User+') );
			expect( socketMock.isDisconnected ).toBe( false );
		});
	});

	describe( 'disconnects if the number of invalid authentication attempts is exceeded', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'handles valid auth messages', function(){
			permissionHandlerMock.nextUserValidationResult = false;
			options.maxAuthAttempts = 3;

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|INVALID_AUTH_DATA|Invalid User+' ) );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|INVALID_AUTH_DATA|Invalid User+' ) );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|TOO_MANY_AUTH_ATTEMPTS|too many authentication attempts+' ) );
			expect( socketMock.isDisconnected ).toBe( true );
		});
	});

	describe( 'doesn\'t log credentials if logInvalidAuthData is set to false', function(){
		it( 'creates the connection endpoint', function(){
			options.logInvalidAuthData = false;
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'handles valid auth messages', function(){
			permissionHandlerMock.nextUserValidationResult = false;
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( lastLoggedMessage.indexOf( 'wolfram' ) ).toBe( -1 );
		});
	});

	describe( 'the connection endpoint routes valid auth messages to the permissionHandler', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'authenticates valid sockets', function(){
			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );

			permissionHandlerMock.nextUserValidationResult = true;

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );

			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|A+' ) );
			expect( socketMock.isDisconnected ).toBe( false );
		});

		it( 'forwards messages from authenticated sockets', function(){
			expect( lastAuthenticatedMessage ).toBe( null );
			socketMock.emit( 'message', 'testMsg' );
			expect( lastAuthenticatedMessage ).toBe( 'testMsg' );
		});

		it( 'notifies the permissionHandler when a client disconnects', function(){
			expect( permissionHandlerMock.onClientDisconnectCalledWith ).toBe( null );
			socketMock.close();
			expect( permissionHandlerMock.onClientDisconnectCalledWith ).toBe( 'test-user' );
		});
	});

	describe( 'forwards additional data for positive authentications', function(){
		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
			permissionHandlerMock.reset();
			permissionHandlerMock.nextUserValidationResult = true;
			permissionHandlerMock.sendNextValidAuthWithData = true;
		});

		it( 'authenticates valid sockets', function(){
			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|A|Stest-data+' ) );
		});
	});

	describe( 'closes all client connections on close', function(){

		it( 'calls close on connections', function( done ) {
			var closeSpy = jasmine.createSpy( 'close-event' );
			connectionEndpoint.on( 'close', closeSpy );
			connectionEndpoint.close();

			setTimeout( function() {
				expect( closeSpy ).toHaveBeenCalled();
				done();
			}, 0 );
		} );

		it( 'does not allow future connections', function() {
			socketMock = engineIoMock.simulateConnection();

			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', 'gibberish' );

			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );
		} );

	});

	describe( 'when using an existing HTTP server', function(){

		it ( 'does not create an additional HTTP server', function() {
			var options = {
				webServerEnabled: true,
				'httpServer': httpMock.createServer(),
				permissionHandler: require( '../mocks/permission-handler-mock' ),
				logger: { log: function( logLevel, event, msg ){} }
			};

			spyOn(httpMock, 'createServer');
			var endpoint = new ConnectionEndpoint(options, function(){} );
			expect( httpMock.createServer ).not.toHaveBeenCalled();
		});

		it ( 'ready callback is called if server is already listening', function(done) {
			var server = httpMock.createServer();
			var options = {
				webServerEnabled: true,
				httpServer: server,
				permissionHandler: require( '../mocks/permission-handler-mock' ),
				logger: { log: function( logLevel, event, msg ){} }
			};
			server.listen( 3000, '0.0.0.0' );

			var endpoint = new ConnectionEndpoint(options, function() {
				done();
			});
		});

		it ( 'ready callback is called if server starts listening after endpoint creation', function(done) {
			var server = httpMock.createServer();
			var options = {
				webServerEnabled: true,
				httpServer: server,
				permissionHandler: require( '../mocks/permission-handler-mock' ),
				logger: { log: function( logLevel, event, msg ){} }
			};

			var endpoint = new ConnectionEndpoint(options, function() {
				done();
			});

			setTimeout(function () {
				server.listen( 3000, '0.0.0.0' );
			}, 50);
		});

	});
});