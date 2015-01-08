
var C = require( '../../src/constants/constants' ),
	_msg = require( '../test-helper/test-helper' ).msg,
	messageBuilder = require( '../../src/message/message-builder' );

describe( 'messageBuilder composes valid deepstream messages', function(){

	it( 'creates a simple authentication ack message', function(){
		var msg = messageBuilder.getMsg( C.TOPIC.AUTH, C.ACTIONS.ACK );
		expect( msg ).toBe( _msg( 'A|A+') );
	});

	it( 'creates an event subscription message', function(){
		var msg = messageBuilder.getMsg( C.TOPIC.EVENT, C.ACTIONS.SUBSCRIBE, [ 'someEvent' ] );
		expect( msg ).toBe( _msg( 'E|S|someEvent+') );
	});

	it( 'creates an event message with serialized data', function(){
		var msg = messageBuilder.getMsg( C.TOPIC.EVENT, C.ACTIONS.EVENT, [ 'someEvent', { some: 'data' } ] );
		expect( msg ).toBe( _msg( 'E|EVT|someEvent|{"some":"data"}+') );
	});

	it( 'creates an invalid message data error message', function(){
		var msg = messageBuilder.getErrorMsg( C.TOPIC.ERROR, C.EVENT.INVALID_MESSAGE_DATA, 'someError' );
		expect( msg ).toBe( _msg( 'X|E|INVALID_MESSAGE_DATA|someError+') );
	});

	it( 'sends messages with missing error message strings', function(){
		var msg = messageBuilder.getErrorMsg( C.TOPIC.ERROR, C.EVENT.NO_RPC_PROVIDER );
		expect( msg ).toBe( _msg( 'X|E|NO_RPC_PROVIDER|undefined+') );
	});
});