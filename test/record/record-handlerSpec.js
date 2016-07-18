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
		clientA = new SocketWrapper( new SocketMock(), {} ),
		clientB = new SocketWrapper( new SocketMock(), {} ),
		options = {
			cache: new StorageMock(),
			storage: new StorageMock(),
			storageExclusion: new RegExp( 'no-storage'),
			logger: new LoggerMock(),
			messageConnector: noopMessageConnector,
			permissionHandler: { canPerformAction: function( a, b, c ){ c( null, true ); }}
		};

	it( 'creates the record handler', function(){
		recordHandler = new RecordHandler( options );
		expect( recordHandler.handle ).toBeDefined();
	});

	it( 'rejects messages with invalid data', function(){
		recordHandler.handle( clientA, {
			raw: 'raw-message',
			topic: 'R',
			action: 'CR',
			data: []
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|raw-message+') );
	});

	it( 'handles unknown actions', function(){
		recordHandler.handle( clientA, {
			raw: 'raw-message',
			topic: 'R',
			action: 'DOES_NOT_EXIST',
			data: [ 'someRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|UNKNOWN_ACTION|unknown action DOES_NOT_EXIST+') );
	});

	it( 'creates a non existing record', function(){
		recordHandler.handle( clientA, {
			topic: 'R',
			action: 'CR',
			data: [ 'someRecord' ]
		});

		expect( options.cache.lastSetKey ).toBe( 'someRecord' );
		expect( options.cache.lastSetValue ).toEqual( { _v : 0, _d : {  } } );

		expect( options.storage.lastSetKey ).toBe( 'someRecord' );
		expect( options.storage.lastSetValue ).toEqual( { _v : 0, _d : {  } } );

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|someRecord|0|{}+') );
	});

	it( 'tries to create a non existing record, but receives an error from the cache', function(){
		options.cache.failNextSet = true;

		recordHandler.handle( clientA, {
			topic: 'R',
			action: 'CR',
			data: [ 'someRecord7' ]
		});

		expect( clientA.socket.sendMessages ).toContain( msg( 'R|E|RECORD_CREATE_ERROR|someRecord7+' ) );
	});

	it( 'tries to create a non existing record, but receives an error from the cache', function(){
		options.storage.failNextSet = true;
		options.logger.lastLogMessage = null;
		recordHandler.handle( clientA, {
			topic: 'R',
			action: 'CR',
			data: [ 'someRecord8' ]
		});

		expect( options.logger.lastLogMessage ).toBe( 'storage:storageError' );
	});


	it( 'does not store new record when excluded', function(){
		options.storage.lastSetKey = null;
		options.storage.lastSetValue = null;

		recordHandler.handle( clientA, {
			topic: 'R',
			action: 'CR',
			data: [ 'no-storage' ]
		});

		expect( options.storage.lastSetKey ).toBe( null );
		expect( options.storage.lastSetValue ).toBe( null );
	});

	it( 'returns an existing record', function(){
		options.cache.set( 'existingRecord', { _v:3, _d: { firstname: 'Wolfram' } }, function(){} );
		recordHandler.handle( clientA, {
			topic: 'R',
			action: 'CR',
			data: [ 'existingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|existingRecord|3|{"firstname":"Wolfram"}+' ));
	});

	it( 'returns true for HAS if message exists', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|H|existingRecord' ),
			topic: 'R',
			action: 'H',
			data: [ 'existingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|H|existingRecord|T+' ) );
	});

	it( 'returns false for HAS if message doesn\'t exists', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|H|nonExistingRecord' ),
			topic: 'R',
			action: 'H',
			data: [ 'nonExistingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|H|nonExistingRecord|F+' ) );
	});

	it( 'returns an error for HAS if message error occurs with record retrieval', function(){
		options.cache.nextOperationWillBeSuccessful = false;

		recordHandler.handle( clientA, {
			raw: msg( 'R|H|existingRecord' ),
			topic: 'R',
			action: 'H',
			data: [ 'existingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|H|existingRecord|RECORD_LOAD_ERROR+' ) );

		options.cache.nextOperationWillBeSuccessful = true;
	});

	it( 'returns a snapshot of the data that exists with version number and data', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|SN|existingRecord' ),
			topic: 'R',
			action: 'SN',
			data: [ 'existingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|existingRecord|3|{"firstname":"Wolfram"}+' ));
	});


	it( 'returns an error for a snapshot of data that doesn\'t exists', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|SN|nonExistingRecord' ),
			topic: 'R',
			action: 'SN',
			data: [ 'nonExistingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|SN|nonExistingRecord|RECORD_NOT_FOUND+' ));
	});

	it( 'returns an error for a snapshot if message error occurs with record retrieval', function(){
		options.cache.nextOperationWillBeSuccessful = false;

		recordHandler.handle( clientA, {
			raw: msg( 'R|SN|existingRecord' ),
			topic: 'R',
			action: 'SN',
			data: [ 'existingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|SN|existingRecord|RECORD_LOAD_ERROR+' ) );

		options.cache.nextOperationWillBeSuccessful = true;
	});

	it( 'patches a record', function(){
		recordHandler.handle( clientB, {
			raw: msg( 'R|P|existingRecord|4|lastname|SEgon' ),
			topic: 'R',
			action: 'P',
			data: [ 'existingRecord', 4, 'lastname', 'SEgon' ]
		});

		expect( clientB.socket.lastSendMessage ).toBe( null );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|P|existingRecord|4|lastname|SEgon+' ));
	});

	it( 'returns the patched record', function(){
		recordHandler.handle( clientB, {
			topic: 'R',
			action: 'CR',
			data: [ 'existingRecord' ]
		});

		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|R|existingRecord|4|{"firstname":"Wolfram","lastname":"Egon"}+' ));
	});

	it( 'updates a record', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|5|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 5, '{"name":"Kowalski"}' ]
		});

		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|U|existingRecord|5|{"name":"Kowalski"}+' ) );
		options.cache.get( 'existingRecord', function( error, record ){
			expect( record ).toEqual({ _v: 5, _d: { name: 'Kowalski' } });
		});
	});

	it( 'updates a record with an invalid version number', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|x|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 'x', '{"name":"Kowalski"}' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_VERSION|existingRecord|NaN+' ) );
	});

	it( 'handles unsubscribe messages', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|US|someRecord' ),
			topic: 'R',
			action: 'US',
			data: [ 'someRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|A|US|someRecord+' ) );

		recordHandler.handle( clientB, {
			raw: msg( 'R|US|someRecord' ),
			topic: 'R',
			action: 'U',
			data: [ 'someRecord', 1, '{"bla":"blub"}' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|A|US|someRecord+' ) );
	});

	it( 'rejects updates for existing versions', function(){
		clientA.user = 'someUser';

		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|5|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 5, '{"name":"Kowalski"}' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|VERSION_EXISTS|existingRecord|5|{"name":"Kowalski"}+' ) );
		expect( options.logger.lastLogMessage ).toBe( msg( 'someUser tried to update record existingRecord to version 5 but it already was 5' ) );
	});

	it( 'handles invalid update messages', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|6' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 6 ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|existingRecord+' ) );
	});

	it( 'handles invalid patch messages', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|6|bla' ),
			topic: 'R',
			action: 'P',
			data: [ 'existingRecord', 6, 'bla']
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|R|U|existingRecord|6|bla+' ) );
	});

	it( 'updates a record via same client to the same version', function( done ){
		options.cacheRetrievalTimeout = 50;
		options.cache.nextGetWillBeSynchronous = false;
		clientA.socket.lastSendMessage = null;
		clientB.socket.lastSendMessage = null;

		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|6|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 6, '{"name":"Kowalski"}' ]
		});

		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|6|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 6, '{"name":"Kowalski"}' ]
		});

		setTimeout(function(){
			expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|U|existingRecord|6|{"name":"Kowalski"}+' ) );

			/**
			* Important to note this is a race condition since version exists errors are sent as soon as record is retrieved,
			* which means it hasn't yet been written to cache.
			*/
			expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|E|VERSION_EXISTS|existingRecord|5|{"name":"Kowalski"}+' ) );
			done();
		}, 50 );

	});

	it( 'updates a record via different clients to the same version', function( done ){
		options.cacheRetrievalTimeout = 50;
		options.cache.nextGetWillBeSynchronous = false;
		clientA.socket.lastSendMessage = null;
		clientB.socket.lastSendMessage = null;

		recordHandler.handle( clientA, {
			raw: msg( 'R|U|existingRecord|7|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 7, '{"name":"Kowalski"}' ]
		});

		recordHandler.handle( clientB, {
			raw: msg( 'R|U|existingRecord|7|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 7, '{"name":"Kowalski"}' ]
		});

		setTimeout(function(){
			expect( clientA.socket.lastSendMessage ).toBeNull();
			/**
			* Important to note this is a race condition since version exists flushes happen before the new record is 
			* written to cache. 
			*/
			expect( clientB.socket.getMsg( 1 ) ).toBe( msg( 'R|E|VERSION_EXISTS|existingRecord|6|{"name":"Kowalski"}+' ) );
			expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|U|existingRecord|7|{"name":"Kowalski"}+' ) );
			done();
		}, 50 );

	});

	it( 'handles deletion messages', function(){
		options.cache.nextGetWillBeSynchronous = false;
		recordHandler.handle( clientB, {
			raw: msg( 'R|U|existingRecord|8|{"name":"Kowalski"}' ),
			topic: 'R',
			action: 'U',
			data: [ 'existingRecord', 8, '{"name":"Kowalski"}' ]
		});

		recordHandler.handle( clientA, {
			raw: msg( 'R|D|existingRecord' ),
			topic: 'R',
			action: 'D',
			data: [ 'existingRecord' ]
		});


		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|A|D|existingRecord+' ) );
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'R|A|D|existingRecord+' ) );

		options.cache.get( 'existingRecord', function( error, record ){
			expect( record ).toEqual( undefined );
		});
	});

	it( 'creates another record', function(){
		options.cache.nextGetWillBeSynchronous = true;
		recordHandler.handle( clientA, {
			topic: 'R',
			action: 'CR',
			data: [ 'anotherRecord' ]
		});

		expect( options.cache.lastSetKey ).toBe( 'anotherRecord' );
		expect( options.cache.lastSetValue ).toEqual( { _v : 0, _d : {  } } );

		expect( options.storage.lastSetKey ).toBe( 'anotherRecord' );
		expect( options.storage.lastSetValue ).toEqual( { _v : 0, _d : {  } } );

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|anotherRecord|0|{}+') );
	});

	it( 'receives a deletion message from the message connector for anotherRecord', function(){
		recordHandler.handle( 'SOURCE_MESSAGE_CONNECTOR', {
			raw: msg( 'R|D|anotherRecord' ),
			topic: 'R',
			action: 'D',
			data: [ 'anotherRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|D|anotherRecord+' ) );
	});

});


describe( 'record handler handles messages', function(){
	var recordHandler,
		clientA = new SocketWrapper( new SocketMock(), {} ),
		clientB = new SocketWrapper( new SocketMock(), {} ),
		options = {
			cache: new StorageMock(),
			storage: new StorageMock(),
			storageExclusion: new RegExp( 'no-storage'),
			logger: new LoggerMock(),
			messageConnector: noopMessageConnector,
			permissionHandler: { canPerformAction: function( a, b, c ){ c( null, true ); }}
		};

	options.cache.nextGetWillBeSynchronous = true;

	it( 'creates the record handler', function(){
		recordHandler = new RecordHandler( options );
		expect( recordHandler.handle ).toBeDefined();
	});

	it( 'creates record test', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|CR|test' ),
			topic: 'R',
			action: 'CR',
			data: [ 'test' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|test|0|{}+' ) );
	});

	it( 'deletes record test', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'R|D|test' ),
			topic: 'R',
			action: 'D',
			data: [ 'test' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|A|D|test+' ) );
	});

	it( 'creates record test', function(){
		clientA.socket.sendMessages = [];
		recordHandler.handle( clientA, {
			raw: msg( 'R|CR|test' ),
			topic: 'R',
			action: 'CR',
			data: [ 'test' ]
		});

		expect( clientA.socket.sendMessages[ 0 ] ).not.toContain( 'MULTIPLE_SUBSCRIPTIONS' );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'R|R|test|0|{}+' ) );
	});
});