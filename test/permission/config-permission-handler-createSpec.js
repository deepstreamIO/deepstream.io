var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var StorageMock = require( '../mocks/storage-mock' );

var options = {
	logger: { log: jasmine.createSpy( 'log' ) },
	cache: new StorageMock(),
	storage: new StorageMock(),
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

describe( 'allows to create a record without providing data, but denies updating it', function(){
	var permissions = getBasePermissions();
	permissions.record[ 'some/*' ] = {
		write: 'data.name === "Wolfram"'
	};

	it( 'allows creating the record', function(){
		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.CREATEORREAD,
			data: [ 'some/tests' ]
		};

		expect( testPermission( permissions, message ) ).toBe( true );
		options.cache.set( 'some/tests', {}, function(){} );
	});

	it( 'denies update', function(){
		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'some/tests', 2, '{"other":"data"}' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBeNull();
			expect( result ).toBe( false );
		};

		testPermission( permissions, message, 'some-user', null, callback );
	});

	it( 'denies patch', function(){
		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.PATCH,
			data: [ 'some/tests', 2, 'apath', 'SaValue' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBeNull();
			expect( result ).toBe( false );
		};

		testPermission( permissions, message, 'some-user', null, callback );
	});
});