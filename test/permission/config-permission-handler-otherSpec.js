var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var options = {
	logger: { log: jasmine.createSpy( 'log' ) },
	permission: {
		options: {
			cacheEvacuationInterval: 60000,
			maxRuleIterations: 3,
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

describe( 'supports spaces after variables and escaped quotes', function(){
	it( 'errors for read with data', function(){
		var permissions = getBasePermissions();
		permissions.record.someUser = {
			"read": "data.firstname === \"Yasser\"",
			"write": "data .firstname === \"Yasser\""
		};

		try{
			new ConfigPermissionHandler( options, permissions );
		} catch( e ) {
			expect( e.toString() ).toContain( 'invalid permission config - rule read for record does not support data' );
		}
	});

	it( 'allows yasser', function( next ){
		var permissions = getBasePermissions();
		permissions.record.someUser = {
			"write": "data .firstname === \"Yasser\""
		};
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
		var permissions = getBasePermissions();
		permissions.record.someUser = {
			"write": "data .firstname === \"Yasser\""
		};

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