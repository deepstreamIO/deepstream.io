/* global describe, expect, it, jasmine */
var RecordHandler = require( '../../src/record/record-handler' ),
	msg = require( '../test-helper/test-helper' ).msg,
	StorageMock = require( '../mocks/storage-mock' ),
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	DataTransforms = require( '../../src/message/data-transforms' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' );

function createRecordHandler( dataTransformSettings ) {
	var recordHandler,
		clients = [],
		options = {
			cache: new StorageMock(),
			storage: new StorageMock(),
			logger: new LoggerMock(),
			messageConnector: noopMessageConnector,
			permissionHandler: { canPerformAction: function( a, b, c ){ c( null, true ); }}
		};

	if( dataTransformSettings ) {
		options.dataTransforms = new DataTransforms( dataTransformSettings );
	}

	return new RecordHandler( options );
}

function createSubscribedClient( recordHandler, clientName ) {
	var client = new SocketWrapper( new SocketMock(), {} );
	client.user = clientName;
	recordHandler.handle( client, {
		topic: 'R',
		action: 'CR',
		data: [ 'someRecord' ]
	});

	return client;
}

describe( 'record handler handles messages', function(){

	it( 'sends unaltered read messages if no transformation is defined', function(){
		var recordHandler = createRecordHandler();
		var clientA = createSubscribedClient( recordHandler );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{}+' ) );
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|someRecord|1|{"testCount":1}+' ),
			topic: 'R',
			action: 'U',
			data: [ 'someRecord', '1', '{"testCount":1}' ]
		});
		var clientB = createSubscribedClient( recordHandler );
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|1|{"testCount":1}+' ) );
	});

	it( 'sends modified read messages if a transformation is defined', function(){
		var transformSettings = {
			topic: 'R',
			action: 'R',
			transform: function( data, metaData ) {
				data.extraValue = 'extraStuff';
				return data;
			}
		};

		spyOn( transformSettings, 'transform' ).and.callThrough();

		var recordHandler = createRecordHandler([transformSettings]);
		var clientA = createSubscribedClient( recordHandler, 'clientA' );
		expect( transformSettings.transform.calls.argsFor( 0 )[ 1 ] ).toEqual({ receiver: 'clientA', recordName: 'someRecord' });
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{"extraValue":"extraStuff"}+' ) );
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|someRecord|1|{"testCount":1}+' ),
			topic: 'R',
			action: 'U',
			data: [ 'someRecord', '1', '{"testCount":1}' ]
		});
		var clientB = createSubscribedClient( recordHandler, 'clientB' );
		expect( transformSettings.transform.calls.argsFor( 1 )[ 1 ] ).toEqual({ receiver: 'clientB', recordName: 'someRecord' });
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|1|{"testCount":1,"extraValue":"extraStuff"}+' ) );
	});

	it( 'sends unaltered update messages if no transformation is defined', function(){
		var recordHandler = createRecordHandler();
		var clientA = createSubscribedClient( recordHandler, 'clientA' );
		var clientB = createSubscribedClient( recordHandler, 'clientB' );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{}+' ) );
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|someRecord|1|{"testCount":1}+' ),
			topic: 'R',
			action: 'U',
			data: [ 'someRecord', '1', '{"testCount":1}' ]
		});
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|U|someRecord|1|{"testCount":1}+' ) );
	});

	it( 'sends transformed update messages if a transformation is defined', function(){
		var transformSettings = {
			topic: 'R',
			action: 'U',
			transform: function( data, metaData ) {
				data.testCount += 7;
				return data;
			}
		};

		spyOn( transformSettings, 'transform' ).and.callThrough();

		var recordHandler = createRecordHandler([transformSettings]);
		var clientA = createSubscribedClient( recordHandler, 'clientA' );
		var clientB = createSubscribedClient( recordHandler, 'clientB' );
		var clientC = createSubscribedClient( recordHandler, 'clientC' );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{}+' ) );
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|someRecord|1|{"testCount":1}+' ),
			topic: 'R',
			action: 'U',
			data: [ 'someRecord', '1', '{"testCount":1}' ]
		});

		expect( transformSettings.transform.calls.count() ).toBe( 2 );
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|U|someRecord|1|{"testCount":8}+' ) );
		expect( clientC.socket.lastSendMessage ).toBe( msg( 'R|U|someRecord|1|{"testCount":8}+' ) );
		expect( transformSettings.transform.calls.argsFor( 1 )[ 1 ] ).toEqual({ recordName: 'someRecord', version: 1, receiver: 'clientC' });
	});

	it( 'sends unaltered patch messages if no transformation is defined', function(){
		var recordHandler = createRecordHandler();
		var clientA = createSubscribedClient( recordHandler, 'clientA' );
		var clientB = createSubscribedClient( recordHandler, 'clientB' );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{}+' ) );
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|someRecord|1|{"testCount":1}+' ),
			topic: 'R',
			action: 'U',
			data: [ 'someRecord', '1', '{"testCount":1}' ]
		});
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|U|someRecord|1|{"testCount":1}+' ) );
		
		recordHandler.handle( clientA, {
			raw: msg( 'R|P|someRecord|2|patchTestValue|N21+' ),
			topic: 'R',
			action: 'P',
			data: [ 'someRecord', '2', 'patchTestValue', 'N21' ]
		});
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|P|someRecord|2|patchTestValue|N21+' ) );
	});

	it( 'sends transformed patch messages if a transformation is defined', function(){
		var transformSettings = {
			topic: 'R',
			action: 'P',
			transform: function( data, metaData ) {
				if( metaData.path === 'patchTestValue' ) {
					return data * 2;
				}
			}
		};

		spyOn( transformSettings, 'transform' ).and.callThrough();

		var recordHandler = createRecordHandler([transformSettings]);
		var clientA = createSubscribedClient( recordHandler, 'clientA' );
		var clientB = createSubscribedClient( recordHandler, 'clientB' );
		var clientC = createSubscribedClient( recordHandler, 'clientC' );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{}+' ) );
		
		recordHandler.handle( clientA, {
			raw: msg( 'R|P|someRecord|1|patchTestValue|N21+' ),
			topic: 'R',
			action: 'P',
			data: [ 'someRecord', '1', 'patchTestValue', 'N21' ]
		});

		expect( transformSettings.transform.calls.count() ).toBe( 2 );
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|P|someRecord|1|patchTestValue|N42+' ) );
		expect( clientC.socket.lastSendMessage ).toBe( msg( 'R|P|someRecord|1|patchTestValue|N42+' ) );
		expect( transformSettings.transform.calls.argsFor( 1 )[ 1 ] ).toEqual({
			recordName : 'someRecord',
			version : 1,
			path : 'patchTestValue',
			receiver : 'clientC'
		});
	});
});