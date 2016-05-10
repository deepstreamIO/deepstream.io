/* global describe, it, expect, jasmine */
var RecordRequest = require( '../../src/record/record-request' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	StorageMock = require( '../mocks/storage-mock' ),
	msg = require( '../test-helper/test-helper' ).msg;

describe( 'records are requested from cache and storage sequentually', function(){
	var recordRequest,
		socketWrapper = new SocketWrapper( new SocketMock(), {} ),
		options = {
			cacheRetrievalTimeout: 10,
			storageRetrievalTimeout: 10,
			cache: new StorageMock(),
			storage: new StorageMock(),
			logger: { log: jasmine.createSpy( 'log' ) }
		};

	options.cache.set( 'existingRecord', { _v:1, _d: {} }, function(){});
	options.storage.set( 'onlyExistsInStorage', { _v:1, _d: {} }, function(){});

	it( 'requests a record that exists in a synchronous cache', function(){
		var completeCallback = jasmine.createSpy( 'completeCallback' );
		options.cache.nextOperationWillBeSynchronous = true;
		recordRequest = new RecordRequest( 'existingRecord', options, socketWrapper, completeCallback );
		expect( options.cache.lastRequestedKey ).toBe( 'existingRecord' );
		expect( completeCallback ).toHaveBeenCalledWith( { _v:1, _d: {} } );
		expect( options.storage.lastRequestedKey ).toBe( null );
	});

	it( 'requests a record that exists in an asynchronous cache', function( done ){
		options.cache.nextGetWillBeSynchronous = false;
		recordRequest = new RecordRequest( 'existingRecord', options, socketWrapper, function( record ){
			expect( record ).toEqual( { _v:1, _d: {} } );
			done();
		});
		expect( options.cache.lastRequestedKey ).toBe( 'existingRecord' );
		expect( options.storage.lastRequestedKey ).toBe( null );
	});

	it( 'requests a record that doesn\'t exists in a synchronous cache, but in storage', function( done ){
		options.cache.nextGetWillBeSynchronous = true;

		recordRequest = new RecordRequest( 'onlyExistsInStorage', options, socketWrapper, function( record ){
			expect( record ).toEqual( { _v:1, _d: {} } );
			done();
		});

		expect( options.cache.lastRequestedKey ).toBe( 'onlyExistsInStorage' );
		expect( options.storage.lastRequestedKey ).toBe( 'onlyExistsInStorage' );
	});

	it( 'requests a record that doesn\'t exists in an asynchronous cache, but in asynchronous storage', function( done ){
		options.cache.nextGetWillBeSynchronous = false;
		options.cache.nextGetWillBeSynchronous = false;

		recordRequest = new RecordRequest( 'onlyExistsInStorage', options, socketWrapper, function( record ){
			expect( record ).toEqual( { _v:1, _d: {} } );
			done();
		});

		expect( options.cache.lastRequestedKey ).toBe( 'onlyExistsInStorage' );
		expect( options.storage.lastRequestedKey ).toBe( 'onlyExistsInStorage' );
	});

	it( 'returns null for non existent records', function( done ){
		options.cache.nextGetWillBeSynchronous = true;

		recordRequest = new RecordRequest( 'doesNotExist', options, socketWrapper, function( record ){
			expect( record ).toBe( null );
			done();
		});

		expect( options.cache.lastRequestedKey ).toBe( 'doesNotExist' );
		expect( options.storage.lastRequestedKey ).toBe( 'doesNotExist' );
	});

	it( 'fails gracefully if an error occured out of order', function( done ){
		options.cache.nextGetWillBeSynchronous = true;
		options.storage.nextGetWillBeSynchronous = false;

		recordRequest = new RecordRequest( 'doesNotExist', options, socketWrapper, function( record ){
			expect( record ).toBe( null );
			done();
		});

		recordRequest._isDestroyed = true;
		setTimeout(done, 20 );
	});

	it( 'handles storage errors', function(){
		options.cache.nextGetWillBeSynchronous = true;
		options.storage.nextGetWillBeSynchronous = true;
		options.storage.nextOperationWillBeSuccessful = false;

		recordRequest = new RecordRequest( 'doesNotExist', options, socketWrapper, function( record ){
			expect( record ).toBe( null );
			done();
		});

		expect( options.logger.log ).toHaveBeenCalledWith( 3, 'RECORD_LOAD_ERROR', 'error while loading doesNotExist from storage' );

		expect( socketWrapper.socket.lastSendMessage ).toBe( msg( 'R|E|RECORD_LOAD_ERROR|error while loading doesNotExist from storage+' ) );
	});
});

describe( 'excluded records are not put into storage', function(){
	var recordRequest,
		socketWrapper = new SocketWrapper( new SocketMock(), {} ),
		options = {
			cacheRetrievalTimeout: 10,
			storageRetrievalTimeout: 10,
			logger: {log: jasmine.createSpy( 'log' ) },
			cache: new StorageMock(),
			storage: new StorageMock(),
			storageExclusion: new RegExp( 'dont-save' )
		};

	options.storage.delete = jasmine.createSpy( 'storage.delete' ) ;
	options.storage.set( 'dont-save/1', { _v:1, _d: {} }, function(){});

	it( 'returns null when requesting a record that doesn\'t exists in a synchronous cache, and is excluded from storage', function( done ){
		recordRequest = new RecordRequest( 'dont-save/1', options, socketWrapper, function( record ){
			expect( record ).toBeNull();
			expect( options.storage.lastRequestedKey ).toBeNull();
			done();
		});
	});

	it( 'returns null for non existent records', function( done ){
		options.cache.nextGetWillBeSynchronous = true;

		recordRequest = new RecordRequest( 'doesNotExist', options, socketWrapper, function( record ){
			expect( record ).toBe( null );
			expect( options.cache.lastRequestedKey ).toBe( 'doesNotExist' );
			expect( options.storage.lastRequestedKey ).toBe( 'doesNotExist' );
			done();
		});
	});
});

