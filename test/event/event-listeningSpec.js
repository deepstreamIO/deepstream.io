/* global describe, expect, it, jasmine */
var EventHandler = require( '../../src/event/event-handler' ),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' );

describe( 'event handler handles messages', function(){
	var eventHandler,
	    subscribingClient = new SocketWrapper( new SocketMock(), {} ),
		listeningClient = new SocketWrapper( new SocketMock(), {} ),
		options = {
			logger: new LoggerMock()
		};

	it( 'creates the event handler', function(){
		eventHandler = new EventHandler( options );
		expect( eventHandler.handle ).toBeDefined();
	});
	
	it( 'subscribes to event a and b', function() {
	    eventHandler.handle( subscribingClient, {
	        topic: 'E',
	        action: 'S',
	        data: [ 'event/A' ]
	    });
	    expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'E|A|S|event/A+' ) );
	    eventHandler.handle( subscribingClient, {
	        topic: 'E',
	        action: 'S',
	        data: [ 'event/B' ]
	    });
	    expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'E|A|S|event/B+' ) );
	});
	
	it( 'registers a listener', function() {
	    eventHandler.handle( listeningClient, {
	       topic: 'E',
	       action: 'L',
	       data: [ 'event\/.*' ]
	    });
	    
	    expect( listeningClient.socket.getMsg( 2 ) ).toBe( msg( 'E|A|L|event\/.*+' ) );
        expect( listeningClient.socket.getMsg( 1 ) ).toBe( msg( 'E|SP|event\/.*|event/A+' ) );
        expect( listeningClient.socket.getMsg( 0 ) ).toBe( msg( 'E|SP|event\/.*|event/B+' ) );
	});
	
	it( 'makes a new subscription', function() {
	     eventHandler.handle( subscribingClient, {
	        topic: 'E',
	        action: 'S',
	        data: [ 'event/C' ]
	    });
	    expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'E|A|S|event/C+' ) );
	    expect( listeningClient.socket.lastSendMessage ).toBe( msg( 'E|SP|event\/.*|event/C+' ) );
	});
	
	it( 'returns a snapshot of the all event that match the pattern', function(){
		eventHandler.handle( subscribingClient, {
			raw: msg( 'E|LSN|user\/*' ),
			topic: 'E',
			action: 'LSN',
			data: [ 'event\/*' ]
		});

		expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'E|SF|event/*|["event/A","event/B","event/C"]+' ));
	});

	it( 'doesn\'t send messages for subsequent subscriptions', function(){
	     expect( listeningClient.socket.sendMessages.length ).toBe( 4 );
	     eventHandler.handle( subscribingClient, {
	        topic: 'E',
	        action: 'S',
	        data: [ 'event/C' ]
	    });
	    expect( listeningClient.socket.sendMessages.length ).toBe( 4 );
	});
	
	it( 'removes listeners', function() {
	     eventHandler.handle( listeningClient, {
	       topic: 'E',
	       action: 'UL',
	       data: [ 'event\/.*' ]
	    });
	    
	    expect( listeningClient.socket.lastSendMessage ).toBe( msg( 'E|A|UL|event\/.*+' ) );
	    expect( listeningClient.socket.sendMessages.length ).toBe( 5 );
	    
	     eventHandler.handle( subscribingClient, {
	        topic: 'E',
	        action: 'CR',
	        data: [ 'event/D' ]
	    });
	    expect( listeningClient.socket.sendMessages.length ).toBe( 5 );
	});
});