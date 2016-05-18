/* global describe, expect, it, jasmine */
var RecordHandler = require( '../../src/record/record-handler' ),
	msg = require( '../test-helper/test-helper' ).msg,
	StorageMock = require( '../mocks/storage-mock' ),
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	MessageConnectorMock = require( '../mocks/message-connector-mock.js' );

describe( 'messages from direct connected clients and messages that come in via message connector co-exist peacefully', function(){
	var recordHandler,
		subscriber = new SocketWrapper( new SocketMock(), {} ),
		options = {
			cache: new StorageMock(),
			storage: new StorageMock(),
			logger: new LoggerMock(),
			messageConnector: new MessageConnectorMock(),
			permissionHandler: { canPerformAction: function( a, b, c ){ c( null, true ); }}
		};

	it( 'creates the record handler', function(){
		recordHandler = new RecordHandler( options );
		expect( recordHandler.handle ).toBeDefined();

	});

	it( 'subscribes to a record', function() {
	    recordHandler.handle( subscriber, {
	    	topic: 'RECORD',
	    	action: 'CR',
	    	data: [ 'someRecord' ]
	    });

	    expect( options.messageConnector.lastPublishedMessage ).toBe( null );
	    expect( subscriber.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{}+' ) );
	});

	it( 'receives an update for a record via the messageConnector', function() {
		expect( options.cache.lastSetValue ).toEqual( { _v : 0, _d : {  } } );
		expect( options.storage.lastSetValue ).toEqual( { _v : 0, _d : {  } } );

	    recordHandler.handle( 'SOURCE_MESSAGE_CONNECTOR', {
	    	raw: msg( 'R|U|someRecord|1|{"firstname":"Wolfram"}+' ),
	    	topic: 'RECORD',
	    	action: 'U',
	    	data: [ 'someRecord', 1, {"firstname":"Wolfram"} ]
	    });

	    expect( subscriber.socket.lastSendMessage ).toBe( msg( 'R|U|someRecord|1|{"firstname":"Wolfram"}+' ) );
	    expect( options.cache.lastSetValue ).toEqual( { _v : 0, _d : {  } } );
		expect( options.storage.lastSetValue ).toEqual( { _v : 0, _d : {  } } );
	});

	it( 'receives an update from the client and forwards it to the message connector', function() {

	    recordHandler.handle( subscriber, {
	    	raw: msg( 'R|U|someRecord|1|{"firstname":"Wolfram"}+' ),
	    	topic: 'RECORD',
	    	action: 'U',
	    	data: [ 'someRecord', 1, '{"firstname":"Wolfram"}' ]
	    });

	    expect( options.cache.lastSetValue ).toEqual( { _v : 1, _d : { firstname: 'Wolfram' } } );
		expect( options.storage.lastSetValue ).toEqual( { _v : 1, _d : { firstname: 'Wolfram' } } );
		expect( options.messageConnector.lastPublishedMessage ).toEqual({
	    	raw: msg( 'R|U|someRecord|1|{"firstname":"Wolfram"}+' ),
	    	topic: 'RECORD',
	    	action: 'U',
	    	data: [ 'someRecord', 1, '{"firstname":"Wolfram"}' ]
	    });
	});
});