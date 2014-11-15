var SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	permissionHandlerMock = require( '../mocks/permission-handler-mock' ),
	MessageProcessor = require( '../../src/message/message-processor' ),
	SEP = require( '../../src/constants/constants' ).MESSAGE_PART_SEPERATOR,
	messageProcessor,
	lastAuthenticatedMessage = null;

describe( 'the message processor only forwards valid, authorized messages', function(){
	it( 'creates the message processor', function(){
		messageProcessor = new MessageProcessor({ permissionHandler: permissionHandlerMock });
		messageProcessor.onAuthenticatedMessage = function( socketWrapper, message ) {
			lastAuthenticatedMessage = message;
		};
	});

	it( 'rejects invalid messages', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() );
		messageProcessor.process( socketWrapper, 'gibberish' );
		expect( socketWrapper.socket.lastSendMessage ).toBe( 'ERROR'+SEP+'E'+SEP+'MESSAGE_PARSE_ERROR'+SEP+'gibberish' );
	});

	it( 'handles permission errors', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() );
		permissionHandlerMock.nextCanPerformActionResult = 'someError';
		messageProcessor.process( socketWrapper, 'RECORD'+SEP+'R'+SEP+'/user/wolfram' );
		expect( socketWrapper.socket.lastSendMessage ).toBe( 'RECORD'+SEP+'E'+SEP+'MESSAGE_PERMISSION_ERROR'+SEP+'someError' );
	});

	it( 'handles denied messages', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() );
		permissionHandlerMock.nextCanPerformActionResult = false;
		messageProcessor.process( socketWrapper, 'RECORD'+SEP+'R'+SEP+'/user/wolfram' );
		expect( socketWrapper.socket.lastSendMessage ).toBe( 'RECORD'+SEP+'E'+SEP+'MESSAGE_DENIED'+SEP+'RECORD'+SEP+'R'+SEP+'/user/wolfram' );
	});

	it( 'provides the correct arguments to canPerformAction', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() );
		socketWrapper.user = 'someUser';
		permissionHandlerMock.nextCanPerformActionResult = false;
		messageProcessor.process( socketWrapper, 'RECORD'+SEP+'R'+SEP+'/user/wolfram' );
		expect( permissionHandlerMock.lastCanPerformActionQueryArgs.length ).toBe( 3 );
		expect( permissionHandlerMock.lastCanPerformActionQueryArgs[ 0 ] ).toBe( 'someUser' );
		expect( permissionHandlerMock.lastCanPerformActionQueryArgs[ 1 ].data[ 0 ] ).toBe( '/user/wolfram' );
	});

	it( 'forwards validated and permissioned messages', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() );
		socketWrapper.user = 'someUser';
		permissionHandlerMock.nextCanPerformActionResult = true;
		expect( lastAuthenticatedMessage ).toBe( null );
		messageProcessor.process( socketWrapper, 'RECORD'+SEP+'R'+SEP+'/user/wolfram' );
		expect( lastAuthenticatedMessage.raw ).toBe( 'RECORD'+SEP+'R'+SEP+'/user/wolfram' );
	});
});