var proxyquire = require( 'proxyquire' ).noCallThru(),
	websocketMock = require( '../mocks/websocket-mock' ),
	HttpMock = require( '../mocks/http-mock' ),
	httpMock = new HttpMock(),
	httpsMock = new HttpMock(),
	SocketMock = require( '../mocks/socket-mock' ),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', {
		'uws': websocketMock,
		'http': httpMock,
		'https': httpsMock
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
	heartbeatInterval: 4000
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

	it( 'sets autopings on the websocket server', function(){
		expect( websocketMock.pingInterval ).toBe( options.heartbeatInterval );
		expect( websocketMock.pingMessage ).toBe(  _msg( 'C|PI+' ) );
	});

	describe( 'the connection endpoint handles invalid connection messages', function(){

		beforeEach( function(){
			socketMock = websocketMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|CH+' ) );
		});

		it( 'handles gibberish messages', function(){
			socketMock.emit( 'message', 'gibberish' );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|E|MESSAGE_PARSE_ERROR|gibberish+' ) );
			expect( socketMock.isDisconnected ).toBe( true );
		});

		it( 'handles invalid connection topic', function(){
			socketMock.emit( 'message', _msg( 'A|REQ|{}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|E|INVALID_MESSAGE|invalid connection message+' ) );
			expect( socketMock.isDisconnected ).toBe( false );
		});

	});

	describe( 'the connection endpoint handles invalid auth messages', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = websocketMock.simulateConnection();

			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|CH+' ) );
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );

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
			socketMock = websocketMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|CH+' ) );
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );
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
		it( 'handles errors from the websocket server', function(){
			lastLoggedMessage = null;
			websocketMock.emit( 'error', 'bla' );
			expect( lastLoggedMessage ).toBe( 'bla' );
		});
	});

	describe( 'the connection endpoint does not route invalid auth messages to the permissionHandler', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = websocketMock.simulateConnection();
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );
			expect( socketMock.isDisconnected ).toBe( false );
		});

		it( 'handles invalid auth messages', function(){
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

	describe( 'the connection endpoint emits a client events for user with name', function() {
		beforeAll( function() {
			authenticationHandlerMock.nextUserValidationResult = true;
			socketMock = websocketMock.simulateConnection();
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );
		});

		it( 'emits connected event for user with name', function( done ){
			connectionEndpoint.once( 'client-connected', function( socketWrapper ) {
				expect( socketWrapper.user ).toBe( 'test-user' );
				done();
			});

			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
		});

		it( 'emits disconnected event for user with name', function( done ){
			connectionEndpoint.once( 'client-disconnected', function( socketWrapper ) {
				expect( socketWrapper.user ).toBe( 'test-user' );
				done();
			});

			socketMock.close();
		});
	});


	describe( 'the connection endpoint deosn\'t emit client events for user without a name', function() {
		beforeAll( function() {
			authenticationHandlerMock.nextUserIsAnonymous = true;
			authenticationHandlerMock.nextUserValidationResult = true;
			socketMock = websocketMock.simulateConnection();
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );
		});

		afterAll( function() {
			authenticationHandlerMock.nextUserIsAnonymous = false;
		})

		it( 'does not emit connected event', function(){
			authenticationHandlerMock.nextUserIsAnonymous = true;
			var spy = jasmine.createSpy( 'client-connected' );

			connectionEndpoint.once( 'client-connected', spy );
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );

			expect( spy ).not.toHaveBeenCalled();
		});

		it( 'does not emit disconnected event', function(){
			authenticationHandlerMock.nextUserIsAnonymous = true;
			var spy = jasmine.createSpy( 'client-disconnected' );

			connectionEndpoint.once( 'client-disconnected', spy );
			socketMock.close();

			expect( spy ).not.toHaveBeenCalled();
		});

	});


	describe( 'disconnects if the number of invalid authentication attempts is exceeded', function(){

		it( 'creates the connection endpoint', function(){
			socketMock = websocketMock.simulateConnection();
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );
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
			socketMock = websocketMock.simulateConnection();
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

			socketMock = websocketMock.simulateConnection();
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );
		});

		it( 'handles valid auth messages', function(){
			authenticationHandlerMock.nextUserValidationResult = false;
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( lastLoggedMessage.indexOf( 'wolfram' ) ).toBe( -1 );
		});
	});

	describe( 'the connection endpoint routes valid auth messages to the permissionHandler', function(){

		it( 'creates the connection endpoint', function(){
			authenticationHandlerMock.onClientDisconnectCalledWith = null;
			socketMock = websocketMock.simulateConnection();
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );
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
			socketMock.close();
			expect( authenticationHandlerMock.onClientDisconnectCalledWith ).toBe( 'test-user' );
		});
	});

	describe( 'forwards additional data for positive authentications', function(){
		it( 'creates the connection endpoint', function(){
			socketMock = websocketMock.simulateConnection();
			socketMock.emit( 'message', _msg( 'C|CHR|localhost:6021+' ) );

			authenticationHandlerMock.reset();
			authenticationHandlerMock.nextUserValidationResult = true;
			authenticationHandlerMock.sendNextValidAuthWithData = true;
		});

		it( 'authenticates valid sockets', function(){
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|A|Stest-data+' ) );
		});
	});

	// TODO: Test manually to see behaviour
	xdescribe( 'closes all client connections on close', function(){
		var closeSpy = jasmine.createSpy( 'close-event' );
		var unclosedSocket;

		beforeAll( function() {
			unclosedSocket = websocketMock.simulateConnection();
			unclosedSocket.autoClose = false;
			connectionEndpoint.once( 'close', closeSpy );
			connectionEndpoint.close();
		});

		it( 'did not emit close event', function(){
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
			socketMock = websocketMock.simulateConnection();

			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );

			socketMock.emit( 'message', 'gibberish' );

			expect( socketMock.lastSendMessage ).toBe( null );
			expect( socketMock.isDisconnected ).toBe( false );
		} );

	});

});
