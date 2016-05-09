var WebRtcHandler = require( '../../src/webrtc/webrtc-handler' );
var SocketMock = require( '../mocks/socket-mock' );
var SocketWrapper = require( '../../src/message/socket-wrapper' );
var logger = { log: jasmine.createSpy( 'log' ) };
var msg = require( '../test-helper/test-helper' ).msg;

describe( 'webrtc handler', function(){

	var webrtcHandler;
	var calleeListener = new SocketWrapper( new SocketMock() );
	var calleeListenerB = new SocketWrapper( new SocketMock() );
	var calleeListenerC = new SocketWrapper( new SocketMock() );
	var calleeA = new SocketWrapper( new SocketMock() );
	var calleeB = new SocketWrapper( new SocketMock() );


	it( 'initializes the WebRtcHandler', function(){
		webrtcHandler = new WebRtcHandler({ logger: logger });
		expect( typeof webrtcHandler.handle ).toBe( 'function' );
	});

	it( 'tries to register a callee with an invalid message', function(){
		webrtcHandler.handle( calleeA, {
			topic: 'W',
			action: 'RC',
			data: [ 1 ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|E|INVALID_MESSAGE_DATA|undefined+' ) );
	});

	it( 'registers calleeA', function(){
		webrtcHandler.handle( calleeA, {
			topic: 'W',
			action: 'RC',
			data: [ 'calleeA' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|A|S|calleeA+' ) );
	});

	it( 'fails when trying to register calleeA a second time', function(){
		webrtcHandler.handle( calleeA, {
			topic: 'W',
			action: 'RC',
			data: [ 'calleeA' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|E|MULTIPLE_SUBSCRIPTIONS|calleeA+' ) );
	});

	it( 'registers a callee listener', function(){
		webrtcHandler.handle( calleeListener, {
			topic: 'W',
			action: 'LC',
			data: []
		});
		expect( calleeListener.socket.lastSendMessage ).toBe( msg( 'W|WAC|calleeA+' ) );
	});

	it( 'registers calleeB', function(){
		webrtcHandler.handle( calleeB, {
			topic: 'W',
			action: 'RC',
			data: [ 'calleeB' ]
		});

		expect( calleeB.socket.lastSendMessage ).toBe( msg( 'W|A|S|calleeB+' ) );
		expect( calleeListener.socket.lastSendMessage ).toBe( msg( 'W|WCA|calleeB+' ) );
	});

	it( 'registers another calleeListener', function(){
		webrtcHandler.handle( calleeListenerB, {
			topic: 'W',
			action: 'LC',
			data: []
		});
		expect( calleeListenerB.socket.lastSendMessage ).toBe( msg( 'W|WAC|calleeA|calleeB+' ) );
	});

	it( 'unregisters calleeA', function(){
		webrtcHandler.handle( calleeA, {
			topic: 'W',
			action: 'URC',
			data: [ 'calleeA' ]
		});

		expect( calleeA.socket.lastSendMessage ).toBe( msg( 'W|A|US|calleeA+' ) );
		expect( calleeListener.socket.lastSendMessage ).toBe( msg( 'W|WCR|calleeA+' ) );
		expect( calleeListenerB.socket.lastSendMessage ).toBe( msg( 'W|WCR|calleeA+' ) );
	});

	it( 'registers a new calleeListener', function(){
		webrtcHandler.handle( calleeListenerC, {
			topic: 'W',
			action: 'LC',
			data: []
		});
		expect( calleeListenerC.socket.lastSendMessage ).toBe( msg( 'W|WAC|calleeB+' ) );
	});

	it( 'unregisters a calleeListener', function(){
		webrtcHandler.handle( calleeListener, {
			topic: 'W',
			action: 'ULC',
			data: []
		});
		expect( calleeListener.socket.lastSendMessage ).toBe( msg( 'W|A|US|callee-update+' ) );
	});

	it( 'registers calleeA, but does not notify the unregistered listener', function(){
		webrtcHandler.handle( calleeA, {
			topic: 'W',
			action: 'RC',
			data: [ 'calleeA' ]
		});

		expect( calleeListener.socket.lastSendMessage ).toBe( msg( 'W|A|US|callee-update+' ) );
		expect( calleeListenerB.socket.lastSendMessage ).toBe( msg( 'W|WCA|calleeA+' ) );
	});
});