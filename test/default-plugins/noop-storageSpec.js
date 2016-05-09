var noopStorage = require( '../../src/default-plugins/noop-storage' );

describe( 'retuns null for all values', function(){

	it( 'has created the noop storage', function(){
		expect( noopStorage.isReady ).toBe( true );
	});

	it( 'tries to retrieve a non-existing value', function(){
		var successCallback = jasmine.createSpy( 'success' );
		noopStorage.get( 'firstname', successCallback );
		expect( successCallback.calls.count() ).toBe( 1 );
		expect( successCallback.calls.mostRecent().args ).toEqual([ null, null ]);
	});

	it( 'tries to delete a value', function(){
		var successCallback = jasmine.createSpy( 'success' );
		noopStorage.delete( 'firstname', successCallback );
		expect( successCallback.calls.count() ).toBe( 1 );
		expect( successCallback.calls.mostRecent().args ).toEqual([ null ]);
	});
});