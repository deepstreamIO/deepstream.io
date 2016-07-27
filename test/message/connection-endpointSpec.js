var proxyquire = require( 'proxyquire' ).noCallThru(),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	HttpMock = require( '../mocks/http-mock' ),
	httpMock = new HttpMock(),
	httpsMock = new HttpMock(),
	SocketMock = require( '../mocks/socket-mock' ),
	TcpEndpointMock = require( '../mocks/tcp-endpoint-mock'),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', {
		'engine.io': engineIoMock,
		'http': httpMock,
		'https': httpsMock,
		'../tcp/tcp-endpoint': TcpEndpointMock
	} ),
	_msg = require( '../test-helper/test-helper' ).msg,
	permissionHandlerMock = require( '../mocks/permission-handler-mock' ),
	authenticationHandlerMock = require( '../mocks/authentication-handler-mock' ),
	lastAuthenticatedMessage = null,
	lastLoggedMessage = null,
	socketMock,
	options,
	connectionEndpoint;

options = {
	unauthenticatedClientTimeout: null,
	permissionHandler: permissionHandlerMock,
	authenticationHandler: authenticationHandlerMock,
	logger: { log: function( logLevel, event, msg ){ lastLoggedMessage = msg; } },
	maxAuthAttempts: 3,
	logInvalidAuthData: true,
	tcpServerEnabled: true,
	webServerEnabled: true,
	tcpPort: 6021
};

describe( 'connection endpoint', function() {

	beforeAll( function() {
		authenticationHandlerMock.reset();

		connectionEndpoint = new ConnectionEndpoint( options, function(){} );
		connectionEndpoint.onMessage();
		connectionEndpoint.onMessage = function( socket, message ){
			lastAuthenticatedMessage = message;
		};
	});

	afterAll( function( done ) {
		connectionEndpoint.once( 'close', done );
		connectionEndpoint.close();
	});

	describe( 'the connectionEndpoint handles incoming TCP connections', function(){
		it( 'simulates an incoming tcp connection', function(){
			var mockTcpSocket = new SocketMock();
			mockTcpSocket.remoteAddress = 'test-address';
			lastLoggedMessage = null;
			connectionEndpoint._tcpEndpoint.emit( 'connection', mockTcpSocket );
			expect( lastLoggedMessage ).toBe( 'from test-address via tcp' );
		});
	});

	describe( 'the connection endpoint handles invalid auth messages', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|A+' ) );
			expect( socketMock.isDisconnected ).toBe( false );
		});

		it( 'handles invalid auth messages', function(){
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
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|A+' ) );
			expect( socketMock.isDisconnected ).toBe( false );
		});

		it( 'handles invalid json messages', function(){
			socketMock.emit( 'message', _msg( 'A|REQ|{"a":"b}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|INVALID_AUTH_MSG|invalid authentication message+' ) );
			expect( socketMock.isDisconnected ).toBe( true );
		});
	});

	describe( 'handles errors from the servers', function(){
		it( 'handles errors from the engine.io server', function(){
			lastLoggedMessage = null;
			engineIoMock.emit( 'error', 'bla' );
			expect( lastLoggedMessage ).toBe( 'bla' );
		});
	});

	describe( 'the connection endpoint routes valid auth messages to the permissionHandler', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|A+' ) );
			expect( socketMock.isDisconnected ).toBe( false );
		});

		it( 'handles valid auth messages', function(){
			expect( authenticationHandlerMock.lastUserValidationQueryArgs ).toBe( null );

			authenticationHandlerMock.nextUserValidationResult = false;

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );

			expect( authenticationHandlerMock.lastUserValidationQueryArgs.length ).toBe( 3 );
			expect( authenticationHandlerMock.lastUserValidationQueryArgs[ 1 ].user ).toBe( 'wolfram' );
			expect( lastLoggedMessage.indexOf( 'wolfram' ) ).not.toBe( -1 );
			expect( socketMock.lastSendMessage ).toBe( _msg('A|E|INVALID_AUTH_DATA|SInvalid User+') );
			expect( socketMock.isDisconnected ).toBe( false );
		});
	});

	describe( 'disconnects if the number of invalid authentication attempts is exceeded', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'handles valid auth messages', function(){
			authenticationHandlerMock.nextUserValidationResult = false;
			options.maxAuthAttempts = 3;

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|INVALID_AUTH_DATA|SInvalid User+' ) );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|INVALID_AUTH_DATA|SInvalid User+' ) );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|E|TOO_MANY_AUTH_ATTEMPTS|Stoo many authentication attempts+' ) );
			expect( socketMock.isDisconnected ).toBe( true );
		});
	});

	describe( 'disconnects client if authentication timeout is exceeded', function(){

		beforeAll( function() {
			options.unauthenticatedClientTimeout = 100;
			socketMock = engineIoMock.simulateConnection();
		} );

		afterAll( function() {
			options.unauthenticatedClientTimeout = null;
		} );

		it( 'disconnects client after timeout and sends force close', function( done ){
			setTimeout( function() {
				expect( socketMock.lastSendMessage ).toBe( _msg( 'C|E|CONNECTION_AUTHENTICATION_TIMEOUT|Sconnection has not authenticated successfully in the expected time+') );
				expect( socketMock.isDisconnected ).toBe( true );
				done();
			}, 150 );
		});
	});

	describe( 'doesn\'t log credentials if logInvalidAuthData is set to false', function(){
		it( 'creates the connection endpoint', function(){
			options.logInvalidAuthData = false;
			socketMock = engineIoMock.simulateConnection();
		});

		it( 'handles valid auth messages', function(){
			authenticationHandlerMock.nextUserValidationResult = false;
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( lastLoggedMessage.indexOf( 'wolfram' ) ).toBe( -1 );
		});
	});

	describe( 'the connection endpoint routes valid auth messages to the permissionHandler', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|A+' ) );
			expect( socketMock.isDisconnected ).toBe( false );
		});

		it( 'authenticates valid sockets', function(){
			authenticationHandlerMock.nextUserValidationResult = true;

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
			expect( authenticationHandlerMock.onClientDisconnectCalledWith ).toBe( null );
			socketMock.close();
			expect( authenticationHandlerMock.onClientDisconnectCalledWith ).toBe( 'test-user' );
		});
	});

	describe( 'forwards additional data for positive authentications', function(){
		it( 'creates the connection endpoint', function(){
			socketMock = engineIoMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|A+' ) );
			expect( socketMock.isDisconnected ).toBe( false );

			authenticationHandlerMock.reset();
			authenticationHandlerMock.nextUserValidationResult = true;
			authenticationHandlerMock.sendNextValidAuthWithData = true;
		});

		it( 'authenticates valid sockets', function(){
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|A|Stest-data+' ) );
		});
	});

	describe( 'closes all client connections on close', function(){
		var closeSpy = jasmine.createSpy( 'close-event' );
		var unclosedSocket;

		it( 'calls close on connections', function() {
			unclosedSocket = engineIoMock.simulateConnection();
			unclosedSocket.autoClose = false;
			connectionEndpoint.once( 'close', closeSpy );
			connectionEndpoint.close();
			expect( closeSpy ).not.toHaveBeenCalled();
		});

		it( 'closes the last remaining client connection', function( done ){
			connectionEndpoint.once( 'close', done );
			expect( closeSpy ).not.toHaveBeenCalled();
			unclosedSocket.doClose();
		});

		it( 'has closed the server', function(){
			expect( closeSpy ).toHaveBeenCalled();
		});

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

		var endpoint;

		afterEach( function( done ) {
				endpoint.once( 'close', done );
				endpoint.close();
		} );

		it ( 'does not create an additional HTTP server', function() {
			var options = {
				webServerEnabled: true,
				'httpServer': httpMock.createServer(),
				permissionHandler: require( '../mocks/permission-handler-mock' ),
				logger: { log: function( logLevel, event, msg ){} },
				tcpPort: 6021
			};

			spyOn(httpMock, 'createServer');
			endpoint = new ConnectionEndpoint(options, function(){} );
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

			endpoint = new ConnectionEndpoint(options, function() {
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

			endpoint = new ConnectionEndpoint(options, function() {
				done();
			});

			setTimeout(function () {
				server.listen( 3000, '0.0.0.0' );
			}, 50);
		});

		it( 'calling close on server does not destroy server', function(done) {
			var closeCallback = jasmine.createSpy( 'close-callback' );
			var server = httpMock.createServer();
			var options = {
				webServerEnabled: true,
				httpServer: server,
				permissionHandler: require( '../mocks/permission-handler-mock' ),
				logger: { log: function( logLevel, event, msg ){} }
			};

			endpoint = new ConnectionEndpoint(options, function() {
				endpoint.close();
			} );

			endpoint.once( 'close', function() {
				expect( server.closed ).toBe( false );
				done();
			} );

			server.listen( 3000, '0.0.0.0' );
		});

	});
});