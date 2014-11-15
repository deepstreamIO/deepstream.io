var ConnectionEndpoint = require( '../../src/message/connection-endpoint' ),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	options = require( '../../src/default-options' ),
	SEP = require( '../../src/constants/constants' ).MESSAGE_PART_SEPERATOR,
	permissionHandlerMock = require( '../mocks/permission-handler-mock' ),
	lastMessage = null,
	socketMock,
	connectionEndpoint;

options.permissionHandler = require( '../mocks/permission-handler-mock' );
options.logger.log = function(){};
connectionEndpoint = new ConnectionEndpoint( engineIoMock, options );

connectionEndpoint.on( 'message', function( socket, message ){
	lastMessage = message;
});

describe( 'the connection endpoint handles invalid auth messages', function(){

	it( 'creates the connection endpoint', function(){
		socketMock = engineIoMock.simulateConnection();
	});

	it( 'handles invalid auth messages', function(){
		expect( socketMock.lastSendMessage ).toBe( null );
		expect( socketMock.isDisconnected ).toBe( false );

		socketMock.emit( 'message', 'gibberish' );

		expect( socketMock.lastSendMessage ).toBe( 'AUTH'+SEP+'E'+SEP+'INVALID_AUTH_MSG'+SEP+'invalid authentication message' );
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

		socketMock.emit( 'message', 'AUTH' + SEP + 'REQ' + '{"a":"b}' );

		expect( socketMock.lastSendMessage ).toBe( 'AUTH'+SEP+'E'+SEP+'INVALID_AUTH_MSG'+SEP+'invalid authentication message' );
		expect( socketMock.isDisconnected ).toBe( true );
	});
});

describe( 'the connection endpoint routes valid auth messages to the permissionHandler', function(){

	it( 'creates the connection endpoint', function(){
		socketMock = engineIoMock.simulateConnection();
	});

	it( 'handles invalid auth messages', function(){
		expect( socketMock.lastSendMessage ).toBe( null );
		expect( socketMock.isDisconnected ).toBe( false );
		expect( permissionHandlerMock.lastUserValidationQueryArgs ).toBe( null );

		permissionHandlerMock.nextUserValidationResult = false;

		socketMock.emit( 'message', 'AUTH' + SEP + 'REQ' + SEP + '{"user":"wolfram"}' );

		expect( permissionHandlerMock.lastUserValidationQueryArgs.length ).toBe( 3 );
		expect( permissionHandlerMock.lastUserValidationQueryArgs[ 1 ].user ).toBe( 'wolfram' );
		expect( socketMock.lastSendMessage ).toBe( 'AUTH'+SEP+'E'+SEP+'INVALID_AUTH_DATA'+SEP+'invalid authentication data' );
		expect( socketMock.isDisconnected ).toBe( false );
	});
});