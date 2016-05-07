var WebRtcHandler = require( '../../src/webrtc/webrtc-handler' );
var SocketMock = require( '../mocks/socket-mock' );
var SocketWrapper = require( '../../src/message/socket-wrapper' );
var logger = { log: jasmine.createSpy( 'log' ) };
var msg = require( '../test-helper/test-helper' ).msg;

describe( 'webrtc handler', function(){

	var calleeA = new SocketWrapper( new SocketMock() );
	var calleeB = new SocketWrapper( new SocketMock() );
	var localId = 'localId';


	it( 'initializes the WebRtcHandler', function(){
		webrtcHandler = new WebRtcHandler({ logger: logger });
		expect( typeof webrtcHandler.handle ).toBe( 'function' );
	});

	it( 'receives a message with an unknown action', function(){
		webrtcHandler.handle( calleeA, {
			topic: 'W',
			action: 'does-not-exist',
			data: [ 'calleeA' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|E|UNKNOWN_ACTION|does-not-exist+' ) );
	});

	it( 'registers calleeA', function(){
		webrtcHandler.handle( calleeA, {
			topic: 'W',
			action: 'RC',
			data: [ 'calleeA' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|A|S|calleeA+' ) );
	});

	it( 'receives a call for an unknown callee', function(){
		webrtcHandler.handle( calleeB, {
			raw: msg( 'raw-offer-message+' ),
			topic: 'W',
			action: 'OF',
			data: [ localId, 'doesNotExist', 'offer-data' ]
		});

		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'W|E|UNKNOWN_CALLEE|doesNotExist+' ) );
		expect( calleeA.socket.lastSendMessage ).toBe(msg( 'W|A|S|calleeA+' ) );
	});

	it( 'receives a malformed offer offer', function(){
		webrtcHandler.handle( calleeB, {
			raw: msg( 'raw-offer-message' ),
			topic: 'W',
			action: 'OF',
			data: [ localId, 7 ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe(msg( 'W|A|S|calleeA+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'W|E|INVALID_MESSAGE_DATA|raw-offer-message+' ) );
	});

	it( 'receives and forwards an offer', function(){
		webrtcHandler.handle( calleeB, {
			raw: msg( 'raw-offer-message+' ),
			topic: 'W',
			action: 'OF',
			data: [ localId, 'calleeA', 'offer-data' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'raw-offer-message+' ) );
	});

	it( 'receives an answer', function(){
		webrtcHandler.handle( calleeB, {
			raw: msg( 'raw-answer-message+' ),
			topic: 'W',
			action: 'AN',
			data: [ 'calleeA', localId, 'answer-data' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'raw-offer-message+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'raw-answer-message+' ) );
	});

	it( 'sends ICE candidate from a to b', function(){
		webrtcHandler.handle( calleeB, {
			raw: msg( 'raw-ice-message-1+' ),
			topic: 'W',
			action: 'IC',
			data: [ localId, 'calleeA', 'ice-data' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'raw-ice-message-1+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'raw-answer-message+' ) );
	});

	it( 'sends ICE candidate from b to a', function(){
		webrtcHandler.handle( calleeA, {
			raw: msg( 'raw-ice-message-2+' ),
			topic: 'W',
			action: 'IC',
			data: [ 'calleeA', localId, 'ice-data' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'raw-ice-message-1+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'raw-ice-message-2+' ) );
	});

	it( 'checks if the counterparty is still alive with malformed message data', function(){
		webrtcHandler.handle( calleeA, {
			raw: msg( 'raw-is-alive-msg' ),
			topic: 'W',
			action: 'WIA',
			data: [ 'calleeA', localId ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|E|INVALID_MESSAGE_DATA|raw-is-alive-msg+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'raw-ice-message-2+' ) );
	});

	it( 'checks if the counterparty is still alive', function(){
		webrtcHandler.handle( calleeA, {
			raw: msg( 'raw-is-alive-msg+' ),
			topic: 'W',
			action: 'WIA',
			data: [ 'calleeA' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|WIA|calleeA|true+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'raw-ice-message-2+' ) );
	});

	it( 'calleeA ends the call', function(){
		webrtcHandler.handle( calleeA, {
			raw: msg( 'call-end-message+' ),
			topic: 'W',
			action: 'CE',
			data: [ 'calleeA', localId, 'x' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|WIA|calleeA|true+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'W|A|US|localId+' ) );
		expect( calleeB.socket.sendMessages.indexOf( msg( 'call-end-message+' ) ) ).not.toBe( -1 );
	});

	it( 'calleeA tries to send another ICE candidate after the call has ended', function(){
		webrtcHandler.handle( calleeA, {
			raw: msg( 'raw-ice-message-2+' ),
			topic: 'W',
			action: 'IC',
			data: [ 'calleeA', localId, 'ice-data' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|E|UNKNOWN_CALLEE|localId+' ) );
		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'W|A|US|localId+' ) );
	});
});