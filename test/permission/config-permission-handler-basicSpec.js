var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var getBasePermissions = require( '../test-helper/test-helper' ).getBasePermissions;
var C = require( '../../src/constants/constants' );
var options = {
	logger: { log: jasmine.createSpy( 'log' ) },
	permission: {
		options: {
			cacheEvacuationInterval: 60000
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

	it( 'allows actions that dont need permissions for a private record', function(){
		var permissions = getBasePermissions();

		permissions.record[ 'private/$userId' ] = {
			'read': 'user.id === $userId'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UNSUBSCRIBE,
			data: [ 'private/userA' ]
		};

		expect( testPermission( permissions, message, 'userB' ) ).toBe( true );
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

	it( 'checks incoming data against a value for record updates', function(){
		var permissions = getBasePermissions();

		permissions.record[ 'cars/mercedes' ] = {
			'write': 'data.manufacturer === "mercedes-benz"'
		};

		permissions.record[ 'cars/porsche/$model' ] = {
			'write': 'data.price > 50000 && data.model === $model'
		};

		expect( testPermission( permissions, {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'cars/mercedes', 1, '{"manufacturer":"mercedes-benz"}' ]
		}) ).toBe( true );

		expect( testPermission( permissions, {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'cars/mercedes', 1, '{"manufacturer":"BMW"}' ]
		}) ).toBe( false );

		expect( testPermission( permissions, {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'cars/porsche/911', 1, '{"model": "911", "price": 60000 }' ]
		}) ).toBe( true );

		expect( testPermission( permissions, {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'cars/porsche/911', 1, '{"model": "911", "price": 40000 }' ]
		}) ).toBe( false );

		expect( testPermission( permissions, {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'cars/porsche/911', 1, '{"model": "Boxter", "price": 70000 }' ]
		}) ).toBe( false );
	});

	it( 'deals with broken messages', function( next ){
		var permissions = getBasePermissions();

		permissions.record[ 'cars/mercedes' ] = {
			'write': 'data.manufacturer === "mercedes-benz"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.UPDATE,
			data: [ 'cars/mercedes', 1, '{"manufacturer":"mercedes-benz"' ]
		};

		var callback = function( error, result ) {
			expect( lastError() ).toContain( 'error when converting message data' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, 'user', null, callback );
	});

	it( 'deals with messages without data', function( next ){
		var permissions = getBasePermissions();

		permissions.event[ 'some-event' ] = {
			'publish': 'data.manufacturer === "mercedes-benz"'
		};

		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [  ]
		};


		var callback = function( error, result ) {
			expect( error ).toContain( 'invalid message' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, 'user', null, callback );
	});

	it( 'deals with messages with invalid types', function( next ){
		var permissions = getBasePermissions();

		permissions.event[ 'some-event' ] = {
			'publish': 'data.manufacturer === "mercedes-benz"'
		};

		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'xxx' ]
		};

		var callback = function( error, result ) {
			expect( lastError() ).toContain( 'error when converting message data' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, 'user', null, callback );
	});
});

describe( 'loads permissions repeatedly', function(){
	var permissionHandler;

	it( 'creates the permissionHandler', function(){
		permissionHandler = new ConfigPermissionHandler( options, getBasePermissions() );
		permissionHandler.setRecordHandler({ runWhenRecordStable: ( r, c ) => { c(); }});
		expect( permissionHandler.isReady ).toBe( true );
	});

	it( 'requests permissions initally, causing a lookup', function( next ){
		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'some-data' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			next();
		};

		permissionHandler.canPerformAction( 'some-user', message, callback );
	});

		it( 'requests permissions a second time, causing a cache retriaval', function( next ){
		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'some-event', 'some-data' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			next();
		};

		permissionHandler.canPerformAction( 'some-user', message, callback );
	});
});