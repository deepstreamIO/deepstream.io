/* global it, describe, expect, jasmine */
var proxyquire = require( 'proxyquire' ),
	RecordDeletion = require( '../../src/record/record-deletion' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	msg = require( '../test-helper/test-helper' ).msg,
	deletionMsg = { topic: 'R', action: 'D', data: [ 'someRecord' ] };

var getOptions = function() {
	return {
		storage: { delete: jasmine.createSpy( 'storage.delete' ) },
		cache: { delete: jasmine.createSpy( 'storage.cache' ) },
		cacheRetrievalTimeout: 20,
		storageRetrievalTimeout: 20,
		logger: { log: jasmine.createSpy( 'logger.log' ) }
	};
};

describe( 'deletes records - happy path', function(){
	var recordDeletion;
	var options = getOptions();
	var sender = new SocketWrapper( new SocketMock() );
	var successCallback = jasmine.createSpy( 'successCallback' );

	it( 'creates the record deletion', function(){
		expect( options.cache.delete ).not.toHaveBeenCalled();
		expect( options.storage.delete ).not.toHaveBeenCalled();
		recordDeletion = new RecordDeletion( options, sender, deletionMsg, successCallback );
		expect( options.cache.delete.calls.argsFor( 0 )[ 0 ] ).toBe( 'someRecord' );
		expect( options.storage.delete.calls.argsFor( 0 )[ 0 ] ).toBe( 'someRecord' );
	});

	it( 'receives a synchronous response from cache', function(){
		expect( recordDeletion._isDestroyed ).toBe( false );
		expect( successCallback ).not.toHaveBeenCalled();
		options.cache.delete.calls.argsFor( 0 )[ 1 ]( null );
	});

	it( 'receives a synchronous response from storage that completes the recordDeletion', function(){
		expect( recordDeletion._isDestroyed ).toBe( false );
		expect( successCallback ).not.toHaveBeenCalled();
		expect( sender.socket.lastSendMessage ).toBe( null );
		options.storage.delete.calls.argsFor( 0 )[ 1 ]( null );
		expect( sender.socket.lastSendMessage ).toBe( msg( 'R|A|D|someRecord+' ) );
		expect( recordDeletion._isDestroyed ).toBe( true );
		expect( successCallback ).toHaveBeenCalled();	
	});
});

describe( 'encounters an error during record deletion', function(){
	var recordDeletion;
	var options = getOptions();
	var sender = new SocketWrapper( new SocketMock() );
	var successCallback = jasmine.createSpy( 'successCallback' );

	it( 'creates the record deletion', function(){
		expect( options.cache.delete ).not.toHaveBeenCalled();
		expect( options.storage.delete ).not.toHaveBeenCalled();
		recordDeletion = new RecordDeletion( options, sender, deletionMsg, successCallback );
		expect( options.cache.delete.calls.argsFor( 0 )[ 0 ] ).toBe( 'someRecord' );
		expect( options.storage.delete.calls.argsFor( 0 )[ 0 ] ).toBe( 'someRecord' );
	});

	it( 'receives an error from the cache', function(){
		expect( recordDeletion._isDestroyed ).toBe( false );
		expect( successCallback ).not.toHaveBeenCalled();
		options.cache.delete.calls.argsFor( 0 )[ 1 ]( 'an error' );
		expect( recordDeletion._isDestroyed ).toBe( true );
		expect( successCallback ).not.toHaveBeenCalled();
		expect( sender.socket.lastSendMessage ).toBe( msg( 'R|E|RECORD_DELETE_ERROR|an error+' ) );
		expect( options.logger.log.calls.argsFor( 0 )).toEqual([ 3, 'RECORD_DELETE_ERROR', 'an error' ]);
	});

	it( 'receives a confirmation from storage after an error has occured', function(){
		expect( recordDeletion._isDestroyed ).toBe( true );
		options.storage.delete.calls.argsFor( 0 )[ 1 ]( null );
	});
});

describe( 'doesn\'t delete excluded messages from storage', function(){
	var recordDeletion;
	var deletionMsg = { topic: 'R', action: 'D', data: [ 'no-storage/1' ] };
	var options = getOptions();
	options.storageExclusion = new RegExp( 'no-storage/' )
	var sender = new SocketWrapper( new SocketMock() );
	var successCallback = jasmine.createSpy( 'successCallback' );

	it( 'creates the record deletion', function(){
		expect( options.cache.delete ).not.toHaveBeenCalled();
		expect( options.storage.delete ).not.toHaveBeenCalled();
		
		recordDeletion = new RecordDeletion( options, sender, deletionMsg, successCallback );
		
		expect( options.cache.delete.calls.argsFor( 0 )[ 0 ] ).toBe( 'no-storage/1' );
		expect( options.storage.delete ).not.toHaveBeenCalled();
	});

	it( 'receives a response from cache that completes the recordDeletion', function(){
		expect( recordDeletion._isDestroyed ).toBe( false );
		expect( successCallback ).not.toHaveBeenCalled();
		expect( sender.socket.lastSendMessage ).toBe( null );

		options.cache.delete.calls.argsFor( 0 )[ 1 ]( null );
		
		expect( sender.socket.lastSendMessage ).toBe( msg( 'R|A|D|no-storage/1+' ) );
		expect( recordDeletion._isDestroyed ).toBe( true );
		expect( successCallback ).toHaveBeenCalled();	
	});


});