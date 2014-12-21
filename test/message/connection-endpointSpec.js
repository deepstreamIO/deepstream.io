var proxyquire = require( 'proxyquire' ).noCallThru(),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', { 'engine.io': engineIoMock } ),
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
	logInvalidAuthData: true
};

connectionEndpoint = new ConnectionEndpoint( options );

connectionEndpoint.onMessage = function( socket, message ){
	lastAuthenticatedMessage = message;
};

describe( 'the connection endpoint handles invalid auth messages', function(){

	it( 'creates the connection endpoint', function(){
		socketMock = engineIoMock.simulateConnection();
	});

	it( 'handles invalid auth messages', function(){
		expect( socketMock.lastSendMessage ).toBe( null );
		expect( socketMock.isDisconnected ).toBe( false );

		socketMock.emit( 'message', 'gibberish' );

		expect( socketMock.lastSendMessage ).toBe( _msg( 'AUTH|E|INVALID_AUTH_MSG|invalid authentication message+' ) );
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

		socketMock.emit( 'message', _msg( 'AUTH|REQ|{"a":"b}+' ) );

		expect( socketMock.lastSendMessage ).toBe( _msg( 'AUTH|E|INVALID_AUTH_MSG|invalid authentication message+' ) );
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

		socketMock.emit( 'message', _msg( 'AUTH|REQ|{"user":"wolfram"}+' ) );

		expect( permissionHandlerMock.lastUserValidationQueryArgs.length ).toBe( 3 );
		expect( permissionHandlerMock.lastUserValidationQueryArgs[ 1 ].user ).toBe( 'wolfram' );
		expect( lastLoggedMessage.indexOf( 'wolfram' ) ).not.toBe( -1 );
		expect( socketMock.lastSendMessage ).toBe( _msg('AUTH|E|INVALID_AUTH_DATA|Invalid User+') );
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

		socketMock.emit( 'message', _msg( 'AUTH|REQ|{"user":"wolfram"}+' ) );
		expect( socketMock.lastSendMessage ).toBe( _msg( 'AUTH|E|INVALID_AUTH_DATA|Invalid User+' ) );
		expect( socketMock.isDisconnected ).toBe( false );

		socketMock.emit( 'message', _msg( 'AUTH|REQ|{"user":"wolfram"}+' ) );
		expect( socketMock.lastSendMessage ).toBe( _msg( 'AUTH|E|INVALID_AUTH_DATA|Invalid User+' ) );
		expect( socketMock.isDisconnected ).toBe( false );

		socketMock.emit( 'message', _msg( 'AUTH|REQ|{"user":"wolfram"}+' ) );
		expect( socketMock.lastSendMessage ).toBe( _msg( 'AUTH|E|TOO_MANY_AUTH_ATTEMPTS|too many authentication attempts+' ) );
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
		socketMock.emit( 'message', _msg( 'AUTH|REQ|{"user":"wolfram"}+' ) );
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

		socketMock.emit( 'message', _msg( 'AUTH|REQ|{"user":"wolfram"}+' ) );

		expect( socketMock.lastSendMessage ).toBe( _msg( 'AUTH|A+' ) );
		expect( socketMock.isDisconnected ).toBe( false );
	});

	it( 'forwards messages from authenticated sockets', function(){
		expect( lastAuthenticatedMessage ).toBe( null );
		socketMock.emit( 'message', 'testMsg' );
		expect( lastAuthenticatedMessage ).toBe( 'testMsg' );
	});
});