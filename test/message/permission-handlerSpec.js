var proxyquire = require( 'proxyquire' ).noCallThru(),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	HttpMock = require( '../mocks/http-mock' ),
	httpMock = new HttpMock(),
	httpsMock = new HttpMock(),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', { 'engine.io': engineIoMock, 'http': httpMock, 'https': httpsMock } ),
	_msg = require( '../test-helper/test-helper' ).msg,
	lastAuthenticatedMessage = null,
	lastLoggedMessage = null,
	permissionHandler,
	options,
	connectionEndpoint;

permissionHandler = {
	isValidUser: function( connectionData, authData, callback ) {
        callback( true, {
        	username: 'someUser',
        	clientData: { firstname: 'Wolfram' },
        	serverData: { role: authData.role }
        });
    },
    canPerformAction: function( username, message, callback, data ) {
        callback( null, true );
    },
    onClientDisconnect: function( username ){}
};



options = {
	permissionHandler: permissionHandler,
	authenticationHandler: permissionHandler,
	logger: { log: function( logLevel, event, msg ){ lastLoggedMessage = msg; } },
	maxAuthAttempts: 3,
	logInvalidAuthData: true,
	tcpServerEnabled: true,
	webServerEnabled: true,
	tcpPort: 3333
};

describe( 'permissionHandler passes additional user meta data', function() {

	var socketMock;

	it( 'create a connection endpoint', function() {
		connectionEndpoint = new ConnectionEndpoint( options, function(){} );
		connectionEndpoint.onMessage = function( socket, message ){
			lastAuthenticatedMessage = message;
		};
	});

	it( 'creates the connection endpoint', function(){
		socketMock = engineIoMock.simulateConnection();
		expect( socketMock.lastSendMessage ).toBe( _msg( 'C|A+' ) );
		expect( socketMock.isDisconnected ).toBe( false );
	});

	it( 'sends an authentication message', function(){
		spyOn( permissionHandler, 'isValidUser' ).and.callThrough();
		socketMock.emit( 'message', _msg( 'A|REQ|{"role": "admin"}+' ) );
		expect( permissionHandler.isValidUser ).toHaveBeenCalled();
		expect( permissionHandler.isValidUser.calls.mostRecent().args[ 1 ] ).toEqual({ role: 'admin' });
		expect( socketMock.lastSendMessage ).toBe( _msg( 'A|A|O{"firstname":"Wolfram"}+' ) );
	});

	it( 'sends a record read message', function(){
		spyOn( connectionEndpoint, 'onMessage' );
		socketMock.emit( 'message', _msg( 'R|CR|someRecord+' ) );
		expect( connectionEndpoint.onMessage ).toHaveBeenCalled();
		expect( connectionEndpoint.onMessage.calls.mostRecent().args[ 0 ].authData ).toEqual({ role: 'admin' });
	});

});