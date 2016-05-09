var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var testPermission = function( permissions, message, username, userdata ) {
	var options = {
		logger: { log: jasmine.createSpy( 'log' ) }
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


describe( 'permission handler applies basic permissions referencing their own data', function(){
	it( 'checks incoming data against a value for events', function(){
		var permissions = getBasePermissions();

		permissions.event[ 'some-event' ] = {
			'publish': 'data.price < 10'
		};

		expect( testPermission( permissions, {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'O{"price":15}' ]
		}) ).toBe( false );

		expect( testPermission( permissions, {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'O{"price":5}' ]
		}) ).toBe( true );
	});

	it( 'checks incoming data against a value for rpcs', function(){
		var permissions = getBasePermissions();

		permissions.rpc[ '*' ] = {
			request: false
		};

		permissions.rpc[ 'trade/book' ] = {
			'request': 'user.data.role === "fx-trader" && data.assetClass === "fx"'
		};

		expect( testPermission( permissions, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			data: [ 'trade/book', '1234', 'O{"assetClass": "equity"}' ]
		}, null, { role: 'eq-trader' }) ).toBe( false );

		expect( testPermission( permissions, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			data: [ 'trade/book', '1234', 'O{"assetClass": "fx"}' ]
		}, null, { role: 'fx-trader' }) ).toBe( true );

		expect( testPermission( permissions, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			data: [ 'trade/book', '1234', 'O{"assetClass": "fx"}' ]
		}, null, { role: 'eq-trader' }) ).toBe( false );

		expect( testPermission( permissions, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			data: [ 'trade/cancel', '1234', 'O{"assetClass": "fx"}' ]
		}, null, { role: 'fx-trader' }) ).toBe( false );

	});
});
