var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var testPermission = function( permissions, message, username, userdata ) {
	var permissionHandler = new ConfigPermissionHandler( permissions );
	var permissionResult;
	username = username || 'someUser';
	userdata = userdata || {};
	callback = function( error, result ) {
		permissionResult = result;
	};
	permissionHandler.canPerformAction( username, message, callback, userdata );
	return permissionResult;
};

describe( 'permission handler applies basic permissions to incoming messages', function(){
	it( 'allows everything for a basic permission set', function(){
		var permissions = getBasePermissions();
		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'someRecord' ]
		};
		expect( testPermission( permissions, message ) ).toBe( true );
	});

	it( 'denies reading of a private record', function(){
		var permissions = getBasePermissions();

		permissions.record[ 'private/$userId' ] = {
			'read': 'user.id === $userId'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'private/userA' ]
		};

		expect( testPermission( permissions, message, 'userB' ) ).toBe( false );
	});

	it( 'allows reading of a private record for the right user', function(){
		var permissions = getBasePermissions();

		permissions.record[ 'private/$userId' ] = {
			'read': 'user.id === $userId'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'private/userA' ]
		};

		expect( testPermission( permissions, message, 'userA' ) ).toBe( true );
	});
});