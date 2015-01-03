var RecordHandler = require( '../../src/record/record-handler' ),
	msg = require( '../test-helper/test-helper' ).msg,
	StorageMock = require( '../mocks/storage-mock' ),
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' );

describe( 'record handler handles messages', function(){
	var recordHandler,
		clientA = new SocketWrapper( new SocketMock() ),
		clientB = new SocketWrapper( new SocketMock() ),
		options = {
			cache: new StorageMock(),
			storage: new StorageMock(),
			logger: new LoggerMock()
		};

	it( 'creates the record handler', function(){
		recordHandler = new RecordHandler( options );
		expect( recordHandler.handle ).toBeDefined();
	});

	it( 'creates a non existing record', function(){
		recordHandler.handle( clientA, {
			topic: 'RECORD',
			action: 'CR',
			data: [ 'someRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|R|someRecord|0|{}+') );
	});

	it( 'returns an existing record', function(){
		options.cache.set( 'existingRecord', { _v:3, _d: { firstname: 'Wolfram' } }, function(){} );
		recordHandler.handle( clientA, {
			topic: 'RECORD',
			action: 'CR',
			data: [ 'existingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|R|existingRecord|3|{"firstname":"Wolfram"}+' ));
	});

	it( 'patches a record', function(){
		recordHandler.handle( clientB, {
			raw: msg( 'RECORD|P|existingRecord|4|lastname|SEgon' ),
			topic: 'RECORD',
			action: 'P',
			data: [ 'existingRecord', 4, 'lastname', 'SEgon' ]
		});

		expect( clientB.socket.lastSendMessage ).toBe( null );
		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|P|existingRecord|4|lastname|SEgon+' ));
	});

	it( 'returns the patched record', function(){
		recordHandler.handle( clientB, {
			topic: 'RECORD',
			action: 'CR',
			data: [ 'existingRecord' ]
		});

		expect( clientB.socket.lastSendMessage ).toBe( msg( 'RECORD|R|existingRecord|4|{"firstname":"Wolfram","lastname":"Egon"}+' ));
	});

	it( 'updates a record', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'RECORD|U|existingRecord|5|{"name":"Kowalski"}' ),
			topic: 'RECORD',
			action: 'U',
			data: [ 'existingRecord', 5, '{"name":"Kowalski"}' ]
		});

		expect( clientB.socket.lastSendMessage ).toBe( msg( 'RECORD|U|existingRecord|5|{"name":"Kowalski"}+' ) );
		options.cache.get( 'existingRecord', function( error, record ){
			expect( record ).toEqual({ _v: 5, _d: { name: 'Kowalski' } });
		});
	});

	it( 'handles unsubscribe messages', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'RECORD|US|someRecord' ),
			topic: 'RECORD',
			action: 'US',
			data: [ 'someRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|A|US|someRecord+' ) );

		recordHandler.handle( clientB, {
			raw: msg( 'RECORD|US|someRecord' ),
			topic: 'RECORD',
			action: 'U',
			data: [ 'someRecord', 1, '{"bla":"blub"}' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|A|US|someRecord+' ) );
	});

	it( 'rejects updates for existing versions', function(){
		clientA.user = 'someUser';

		recordHandler.handle( clientA, {
			raw: msg( 'RECORD|U|existingRecord|5|{"name":"Kowalski"}' ),
			topic: 'RECORD',
			action: 'U',
			data: [ 'existingRecord', 5, '{"name":"Kowalski"}' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|E|INVALID_VERSION|5+' ) );
		expect( options.logger.lastLogMessage ).toBe( msg( 'someUser tried to update record existingRecord to version 5 but it already was 5' ) );
	});

	it( 'handles invalid update messages', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'RECORD|U|existingRecord|6' ),
			topic: 'RECORD',
			action: 'U',
			data: [ 'existingRecord', 6 ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|E|INVALID_MESSAGE_DATA|existingRecord+' ) );
	});

	it( 'handles invalid patch messages', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'RECORD|U|existingRecord|6|bla' ),
			topic: 'RECORD',
			action: 'P',
			data: [ 'existingRecord', 6, 'bla']
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|E|INVALID_MESSAGE_DATA|RECORD|U|existingRecord|6|bla+' ) );
	});

	it( 'handles deletion messages', function(){
		recordHandler.handle( clientA, {
			raw: msg( 'RECORD|D|existingRecord' ),
			topic: 'RECORD',
			action: 'D',
			data: [ 'existingRecord' ]
		});

		expect( clientA.socket.lastSendMessage ).toBe( msg( 'RECORD|A|D|existingRecord+' ) );
		expect( clientB.socket.lastSendMessage ).toBe( msg( 'RECORD|A|D|existingRecord+' ) );

		options.cache.get( 'existingRecord', function( error, record ){
			expect( record ).toEqual( null );
		});
	});
});