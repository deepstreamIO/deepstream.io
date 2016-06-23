var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var StorageMock = require( '../mocks/storage-mock' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var noop = function(){};
var options = {
	logger: { log: jasmine.createSpy( 'log' ) },
	cache: new StorageMock(),
	storage: new StorageMock(),
	cacheRetrievalTimeout: 500,
	permission: {
		options: {
			cacheEvacuationInterval: 60000,
			maxRuleIterations: 3,
		}
	}
};
var lastError = function() {
	return options.logger.log.calls.mostRecent().args[ 2 ];
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

describe( 'constructs data for patch message validation', function(){

	it( 'fails to set incorrect data', function( next ){
		var permissions = getBasePermissions();
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ 'user/wh' ] = {
			'write': 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
		};

		options.cache.set( 'user/wh', { firstname: 'Wolfram', lastname: 'Something Else' }, noop );

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.PATCH,
			data: [ 'user/wh', 123, 'lastname', 'SMiller' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'succeeds if both old and new data is correct', function( next ){
		var permissions = getBasePermissions();
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ 'user/wh' ] = {
			'write': 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
		};

		options.cache.set( 'user/wh', { firstname: 'Wolfram', lastname: 'Something Else' }, noop );

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.PATCH,
			data: [ 'user/wh', 123, 'lastname', 'SHempel' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'errors if the patch message has invalid data', function( next ){
		var permissions = getBasePermissions();
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ 'user/wh' ] = {
			'write': 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.PATCH,
			data: [ 'user/wh', 123 ]
		};

		var onDone = function( error, result ) {
			expect( lastError() ).toContain( 'Invalid message data' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'errors if the patch message has data with an invalid type', function( next ){
		var permissions = getBasePermissions();
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ 'user/wh' ] = {
			'write': 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.PATCH,
			data: [ 'user/wh', 123, 'lastname', 'QHempel' ]
		};

		var onDone = function( error, result ) {
			expect( lastError() ).toContain( 'Unknown type' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'returns false if patch if for a non existing record', function( next ){
		var permissions = getBasePermissions();
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ '*' ].write = 'data.lastname === "Blob"';

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.PATCH,
			data: [ 'somerecord', 1, 'lastname', 'SHempel' ]
		};

		var onDone = function( error, result ) {
			expect( lastError() ).toContain( 'Tried to apply patch to non-existant record somerecord' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});
});