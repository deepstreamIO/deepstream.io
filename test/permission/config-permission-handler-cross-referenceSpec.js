var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var StorageMock = require( '../mocks/storage-mock' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var noop = function(){};
var lastError = function() {
	return options.logger.log.calls.mostRecent().args[ 2 ];
};
var options = {
	logger: { log: jasmine.createSpy( 'log' ) },
	cache: new StorageMock(),
	storage: new StorageMock(),
	cacheRetrievalTimeout: 500,
	permission: {
		options: {
			cacheEvacuationInterval: 60000
		}
	}
};


var testPermission = function( permissions, message, username, userdata, callback ) {
	var permissionHandler = new ConfigPermissionHandler( options, permissions );
	permissionHandler.setRecordHandler({ removeRecordRequest: () => {}, runWhenRecordStable: ( r, c ) => { c(); }});
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

		options.cache.set( 'item/itemA', { isInStock: true }, noop );
		options.cache.set( 'item/itemB', { isInStock: false }, noop );

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
			expect( lastError() ).toContain( 'TypeError: Cannot read property \'isInStock\' of null' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'mixes old data and cross references', function( next ){

		var permissions = getBasePermissions();
		options.cache.reset();
		options.cache.set( 'userA', { firstname: 'Egon' }, noop );
		options.cache.set( 'userB', { firstname: 'Mike' }, noop );
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

	it( 'retrieves keys from variables', function( next ){
		var permissions = getBasePermissions();

		options.cache.set( 'userX', { firstname: 'Joe' }, noop );

		permissions.event[ 'some-event' ] = {
			'publish': '_(data.owner).firstname === "Joe"'
		};

		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'O{"owner":"userX"}' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			next();
		};

		testPermission( permissions, message, 'username', null, callback );
	});

	it( 'retrieves keys from variables again', function( next ){
		var permissions = getBasePermissions();

		options.cache.set( 'userX', { firstname: 'Mike' }, noop );

		permissions.event[ 'some-event' ] = {
			'publish': '_(data.owner).firstname === "Joe"'
		};

		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'O{"owner":"userX"}' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, 'username', null, callback );
	});

	it( 'handles load errors', function( next ){
		var permissions = getBasePermissions();

		permissions.event[ 'some-event' ] = {
			'publish': '_("bla") < 10'
		};
		options.cache.nextOperationWillBeSuccessful = false;

		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'O{"price":15}' ]
		};

		var callback = function( error, result ) {
			expect( error ).toContain( 'RECORD_LOAD_ERROR' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, 'username', null, callback );
	});
});