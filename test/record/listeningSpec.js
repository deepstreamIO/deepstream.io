/* global describe, expect, it, jasmine */
var RecordHandler = require( '../../src/record/record-handler' ),
	msg = require( '../test-helper/test-helper' ).msg,
	StorageMock = require( '../mocks/storage-mock' ),
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' );

describe( 'record handler handles messages', function(){
	var recordHandler,
	    subscribingClient = new SocketWrapper( new SocketMock(), {} ),
		listeningClient = new SocketWrapper( new SocketMock(), {} ),
		options = {
			cache: new StorageMock(),
			storage: new StorageMock(),
			logger: new LoggerMock(),
			messageConnector: noopMessageConnector,
			permissionHandler: { canPerformAction: function( a, b, c ){ c( null, true ); }}
		};

	it( 'creates the record handler', function(){
		recordHandler = new RecordHandler( options );
		expect( recordHandler.handle ).toBeDefined();
	});

	it( 'subscribes to record a and b', function() {
	    recordHandler.handle( subscribingClient, {
	        topic: 'R',
	        action: 'CR',
	        data: [ 'user/A' ]
	    });
	    expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'R|R|user/A|0|{}+' ) );
	    recordHandler.handle( subscribingClient, {
	        topic: 'R',
	        action: 'CR',
	        data: [ 'user/B' ]
	    });
	    expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'R|R|user/B|0|{}+' ) );
	});

	it( 'registers a listener', function() {
	    recordHandler.handle( listeningClient, {
	       topic: 'R',
	       action: 'L',
	       data: [ 'user\/.*' ]
	    });

	    expect( listeningClient.socket.getMsg( 2 ) ).toBe( msg( 'R|A|L|user\/.*+' ) );
        expect( listeningClient.socket.getMsg( 1 ) ).toBe( msg( 'R|SP|user\/.*|user/A+' ) );
        expect( listeningClient.socket.getMsg( 0 ) ).toBe( msg( 'R|SP|user\/.*|user/B+' ) );
	});

	it( 'makes a new subscription', function() {
	     recordHandler.handle( subscribingClient, {
	        topic: 'R',
	        action: 'CR',
	        data: [ 'user/C' ]
	    });
	    expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'R|R|user/C|0|{}+' ) );
	    expect( listeningClient.socket.lastSendMessage ).toBe( msg( 'R|SP|user\/.*|user/C+' ) );
	});

	it( 'returns a snapshot of the all records that match the pattern', function(){
		recordHandler.handle( subscribingClient, {
			raw: msg( 'R|LSN|user\/*' ),
			topic: 'R',
			action: 'LSN',
			data: [ 'user\/*' ]
		});

		expect( subscribingClient.socket.lastSendMessage ).toBe( msg( 'R|SF|user/*|["user/A","user/B","user/C"]+' ));
	});

	it( 'doesn\'t send messages for subsequent subscriptions', function(){
	     expect( listeningClient.socket.sendMessages.length ).toBe( 4 );
	     recordHandler.handle( subscribingClient, {
	        topic: 'R',
	        action: 'CR',
	        data: [ 'user/C' ]
	    });
	    expect( listeningClient.socket.sendMessages.length ).toBe( 4 );
	});

	it( 'removes listeners', function() {
	     recordHandler.handle( listeningClient, {
	       topic: 'R',
	       action: 'UL',
	       data: [ 'user\/.*' ]
	    });

	    expect( listeningClient.socket.lastSendMessage ).toBe( msg( 'R|A|UL|user\/.*+' ) );
	    expect( listeningClient.socket.sendMessages.length ).toBe( 5 );

	     recordHandler.handle( subscribingClient, {
	        topic: 'R',
	        action: 'CR',
	        data: [ 'user/D' ]
	    });
	    expect( listeningClient.socket.sendMessages.length ).toBe( 5 );
	});
});