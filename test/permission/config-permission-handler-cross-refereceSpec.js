var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var StorageMock = require( '../mocks/storage-mock' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var options = {
	logger: { log: jasmine.createSpy( 'log' ) },
	cache: new StorageMock(),
	storage: new StorageMock(),
	cacheRetrievalTimeout: 100
};


var testPermission = function( permissions, message, username, userdata, callback ) {
	var permissionHandler = new ConfigPermissionHandler( options, permissions );
	var permissionResult;

	username = username || 'someUser';
	userdata = userdata || {};
	callback = callback || function( error, result ) {
		permissionResult = result;
	};
	permissionHandler.canPerformAction( username, message, callback, userdata );
	return permissionResult;
};

describe( 'permission handler loads data for cross referencing', function(){

	beforeAll(function( next ){
		options.cache.set( 'item/doesExist', { isInStock: true }, next );
	});

	it( 'retrieves an existing record from a synchronous cache', function( next ){
		var permissions = getBasePermissions();
		options.cache.nextGetWillBeSynchronous = true;

		permissions.record[ 'purchase/$itemId' ] = {
			'read': '_("item/" + $itemId).isInStock === true'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'purchase/doesExist' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			expect( options.cache.lastRequestedKey ).toBe( 'item/doesExist' );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'retrieves two records from the cache for crossreferencing purposes', function( next ){
		var permissions = getBasePermissions();

		options.cache.set( 'item/itemA', { isInStock: true }, next );
		options.cache.set( 'item/itemB', { isInStock: false }, next );

		options.cache.nextGetWillBeSynchronous = false;
		permissions.record[ 'purchase/$itemId' ] = {
			'read': '_("item/" + $itemId).isInStock === true && _("item/itemB").isInStock === false'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'purchase/itemA' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'retrieves and expects a non existing record', function( next ){
		var permissions = getBasePermissions();

		options.cache.nextGetWillBeSynchronous = false;
		permissions.record[ 'purchase/$itemId' ] = {
			'read': '_("doesNotExist") !== null && _("doesNotExist").isInStock === true'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'purchase/itemA' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'gets a non existant record thats not expected', function( next ){
		var permissions = getBasePermissions();

		options.cache.nextGetWillBeSynchronous = false;
		permissions.record[ 'purchase/$itemId' ] = {
			'read': '_("doesNotExist").isInStock === true'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'purchase/itemA' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( 'TypeError: Cannot read property \'isInStock\' of null' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'mixes old data and cross references', function( next ){

		var permissions = getBasePermissions();
		options.cache.reset();
		options.cache.set( 'userA', { firstname: 'Egon' }, next );
		options.cache.set( 'userB', { firstname: 'Mike' }, next );
		options.cache.nextGetWillBeSynchronous = false;
		permissions.record.userA = {
			'read': 'oldData.firstname === "Egon" && _("userB").firstname === "Mike"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'userA' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			expect( options.cache.getCalls.length ).toBe( 2 );
			expect( options.cache.hadGetFor( 'userA' ) ).toBe( true );
			expect( options.cache.hadGetFor( 'userB' ) ).toBe( true );
			setTimeout( next, 200 );
		};

		testPermission( permissions, message, null, null, onDone );
	});

	//TODO: Breaks everything
	xit( 'retrieves data for a nested cross references', function( next ){
		var permissions = getBasePermissions();
		options.cache.reset();
		options.cache.set( 'thing/x', { ref: 'y' }, next );
		options.cache.set( 'thing/y', { is: 'it' }, next );

		options.cache.nextGetWillBeSynchronous = false;
		permissions.record[ 'test-record' ] = {
			'read': '_( "thing/y" ).is === "it"'
			//'read': '_( "thing/" + _( "thing/x" ) ).is === "it"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'test-record' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			expect( options.cache.getCalls.length ).toBe( 2 );
			expect( options.cache.hadGetFor( 'thing/x' ) ).toBe( true );
			expect( options.cache.hadGetFor( 'thing/y' ) ).toBe( true );
			expect( options.cache.hadGetFor( 'thing/z' ) ).toBe( false );
			next();
		};

		//testPermission( permissions, message, null, null, onDone );
		next();
	});
});