
var C = require( '../../src/constants/constants' ),
	SEP = C.MESSAGE_PART_SEPERATOR,
	messageBuilder = require( '../../src/message/message-builder' );

describe( 'messageBuilder composes valid deepstream messages', function(){

	it( 'creates a simple authentication ack message', function(){
		var msg = messageBuilder.getMsg( C.TOPIC.AUTH, C.ACTIONS.ACK );
		expect( msg ).toBe( 'AUTH' + SEP + 'A' );
	});

	it( 'creates an event subscription message', function(){
		var msg = messageBuilder.getMsg( C.TOPIC.EVENT, C.ACTIONS.SUBSCRIBE, [ 'someEvent' ] );
		expect( msg ).toBe( 'EVENT' + SEP + 'S' + SEP + 'someEvent' );
	});

	it( 'creates an event message with serialized data', function(){
		var msg = messageBuilder.getMsg( C.TOPIC.EVENT, C.ACTIONS.EVENT, [ 'someEvent', { some: 'data' } ] );
		expect( msg ).toBe( 'EVENT' + SEP + 'EVT' + SEP + 'someEvent' + SEP + '{"some":"data"}' );
	});

	it( 'creates an invalid message data error message', function(){
		var msg = messageBuilder.getErrorMsg( C.TOPIC.ERROR, C.EVENT.INVALID_MESSAGE_DATA, 'someError' );
		expect( msg ).toBe( 'ERROR' + SEP + 'E' + SEP + 'INVALID_MESSAGE_DATA' + SEP + 'someError' );
	});
});