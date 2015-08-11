/* global describe, it, expect, jasmine */
var RecordRequest = require( '../../src/record/record-request' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	StorageMock = require( '../mocks/storage-mock' );
	
describe( 'records are requested from cache and storage sequentually', function(){
	var recordRequest,
		socketWrapper = new SocketWrapper( new SocketMock(), {} ),
		options = {
			cacheRetrievalTimeout: 10,
			storageRetrievalTimeout: 10,
			cache: new StorageMock(),
			storage: new StorageMock()
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
		options.cache.nextGetWillBeSynchronous = false

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
});

	