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

describe( 'permission handler loads data for cross referencing', function(){

	it( 'retrieves data for a nested cross references', function( next ){
		var permissions = getBasePermissions();

		options.cache.set( 'thing/x', { ref: 'y' }, noop );
		options.cache.set( 'thing/y', { is: 'it' }, noop );

		options.cache.nextGetWillBeSynchronous = false;
		permissions.record[ 'test-record' ] = {
			'read': '_( "thing/" + _( "thing/x" ).ref ).is === "it"'
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

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'erors for undefined fields in crossreferences', function( next ){
		var permissions = getBasePermissions();

		options.cache.set( 'thing/x', { ref: 'y' }, noop );
		options.cache.set( 'thing/y', { is: 'it' }, noop );

		options.cache.nextGetWillBeSynchronous = false;
		permissions.record[ 'test-record' ] = {
			'read': '_( "thing/" + _( "thing/x" ).doesNotExist ).is === "it"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'test-record' ]
		};

		var onDone = function( error, result ) {
			expect( lastError() ).toContain( 'Cannot read property \'is\' of undefined' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'can use the same cross reference multiple times', function( next ){
		var permissions = getBasePermissions();

		options.cache.reset();
		options.cache.set( 'user', { firstname: 'Wolfram', lastname: 'Hempel' }, noop );
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ 'test-record' ] = {
			'read': '_("user").firstname === "Wolfram" && _("user").lastname === "Hempel"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'test-record' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			expect( options.cache.getCalls.length ).toBe( 1 );
			expect( options.cache.hadGetFor( 'user' ) ).toBe( true );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'supports nested references to the same record', function( next ){
		var permissions = getBasePermissions();

		options.cache.reset();
		options.cache.set( 'user', { ref: 'user', firstname: 'Egon' }, noop );
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ 'test-record' ] = {
			'read': '_(_("user").ref).firstname === "Egon"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'test-record' ]
		};

		var onDone = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			expect( options.cache.getCalls.length ).toBe( 1 );
			expect( options.cache.hadGetFor( 'user' ) ).toBe( true );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'errors for objects as cross reference arguments', function( next ){
		var permissions = getBasePermissions();

		options.cache.reset();
		options.cache.set( 'user', { ref: { bla: 'blub' } }, noop );
		options.cache.nextGetWillBeSynchronous = false;

		permissions.record[ 'test-record' ] = {
			'read': '_(_("user").ref).firstname === "Egon"'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'test-record' ]
		};

		var onDone = function( error, result ) {
			expect( lastError() ).toContain( 'crossreference got unsupported type object' );
			expect( result ).toBe( false );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});

	it( 'prevents nesting beyond limit', function( next ){
		var permissions = getBasePermissions();

		options.cache.reset();
		options.cache.set( 'a', 'a', noop );
		options.cache.set( 'ab', 'b', noop );
		options.cache.set( 'abc', 'c', noop );
		options.cache.set( 'abcd', 'd', noop );
		options.cache.set( 'abcde', 'e', noop );
		options.cache.nextGetWillBeSynchronous = false;
		permissions.record[ 'test-record' ] = {
			'read': '_(_(_(_(_("a")+"b")+"c")+"d")+"e")'
		};

		var message = {
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			data: [ 'test-record' ]
		};

		var onDone = function( error, result ) {
			expect( lastError() ).toContain( 'Exceeded max iteration count' );
			expect( result ).toBe( false );
			expect( options.cache.getCalls.length ).toBe( 3 );
			next();
		};

		testPermission( permissions, message, null, null, onDone );
	});
});