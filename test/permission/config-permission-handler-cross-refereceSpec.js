var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var StorageMock = require( '../mocks/storage-mock' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var testPermission = function( permissions, message, username, userdata ) {
	var options = {
		logger: { log: jasmine.createSpy( 'log' ) },
		cache: new StorageMock(),
		storage: new StorageMock()
	};
	var permissionHandler = new ConfigPermissionHandler( options, permissions );
	var permissionResult;
	username = username || 'someUser';
	userdata = userdata || {};
	callback = function( error, result ) {
		permissionResult = result;
	};
	permissionHandler.canPerformAction( username, message, callback, userdata );
	return permissionResult;
};

describe( 'permission handler loads data for cross referencing', function(){

	it( 'retrieves a record from the cache for crossreferencing purposes', function(){
		var permissions = getBasePermissions();

		permissions.record[ 'purchase/$itemId' ] = {
			'read': '_("item/" + $itemId).isInStock === true'
		};
		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'purchase/12' ]
		};
		expect( testPermission( permissions, message ) ).toBe( true );
	});
});