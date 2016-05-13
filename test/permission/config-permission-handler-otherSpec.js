var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var options = {
	logger: { log: jasmine.createSpy( 'log' ) },
	permissionCacheEvacuationInterval: 60000
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

describe( 'supports spaces after variables and escaped quotes', function(){
	var permissions = getBasePermissions();

	permissions.record.someUser = {
		"read": "data.firstname === \"Yasser\"",
		"write": "data .firstname === \"Yasser\""
	};

	it( 'allows yasser', function( next ){
		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'someUser', 1, '{"firstname":"Yasser"}' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			next();
		};

		testPermission( permissions, message, 'Yasser', null, callback );
	});

	it( 'denies Wolfram', function( next ){
		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'someUser', 1, '{"firstname":"Wolfram"}' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, 'Yasser', null, callback );
	});
});