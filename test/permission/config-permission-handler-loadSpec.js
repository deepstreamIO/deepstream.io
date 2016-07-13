var ConfigPermissionHandler = require( '../../src/permission/config-permission-handler' );
var C = require( '../../src/constants/constants' );

describe( 'permission handler is initialised correctly', function(){
	it( 'loads a valid config file upon initialisation', function( next ){
		var permissionHandler = new ConfigPermissionHandler({
			permission: {
				options: {
					path: './conf/permissions.yml',
					cacheEvacuationInterval: 60000
				}
			}
		});
		permissionHandler.setRecordHandler({ removeRecordRequest: () => {}, runWhenRecordStable: ( r, c ) => { c(); }});
		expect( permissionHandler.isReady ).toBe( false );
		permissionHandler.init();
		permissionHandler.on( 'error', function( error ){
			expect( 'it should not have had this ' + error ).toBe( true );
			next();
		});
		permissionHandler.on( 'ready', function(){
			expect( permissionHandler.isReady ).toBe( true );
			next();
		});
	});

	it( 'fails to load a non existant config file upon initialisation', function( next ){
		var permissionHandler = new ConfigPermissionHandler({
			permission: {
				options: {
					path: './does-not-exist.yml',
					cacheEvacuationInterval: 60000
				}
			}
		});
		permissionHandler.setRecordHandler({ removeRecordRequest: () => {}, runWhenRecordStable: ( r, c ) => { c(); }});
		expect( permissionHandler.isReady ).toBe( false );
		permissionHandler.init();
		permissionHandler.on( 'error', function( error ){
			expect( error ).toContain( 'ENOENT' );
			next();
		});
		permissionHandler.on( 'ready', function(){
			expect( 'should not have gotten here' ).toBe( true );
			next();
		});
	});

	it( 'fails when loading a broken config file upon initialisation', function( next ){
		var permissionHandler = new ConfigPermissionHandler({
			permission: {
				options: {
					path: './test/test-configs/broken-json-config.json',
					cacheEvacuationInterval: 60000
				}
			}
		});
		permissionHandler.setRecordHandler({ removeRecordRequest: () => {}, runWhenRecordStable: ( r, c ) => { c(); }});
		expect( permissionHandler.isReady ).toBe( false );
		permissionHandler.init();
		permissionHandler.on( 'error', function( error ){
			expect( error ).toContain( 'SyntaxError' );
			next();
		});
		permissionHandler.on( 'ready', function(){
			expect( 'should not have gotten here' ).toBe( true );
			next();
		});
	});

	it( 'fails when loading an invalid config file upon initialisation', function( next ){
		var permissionHandler = new ConfigPermissionHandler({
			permission: {
				options: {
					path: './test/test-configs/invalid-permission-conf.json',
					cacheEvacuationInterval: 60000
				}
			}
		});
		permissionHandler.setRecordHandler({ removeRecordRequest: () => {}, runWhenRecordStable: ( r, c ) => { c(); }});
		expect( permissionHandler.isReady ).toBe( false );
		permissionHandler.init();
		permissionHandler.on( 'error', function( error ){
			expect( error ).toBe( 'invalid permission config - empty section "record"' );
			next();
		});
		permissionHandler.on( 'ready', function(){
			expect( 'should not have gotten here' ).toBe( true );
			next();
		});
	});
});

describe( 'it loads a new config during runtime', function(){
	var permissionHandler;
	var onError = jasmine.createSpy( 'error' );

	it( 'loads a valid config file upon initialisation', function( next ){
		permissionHandler = new ConfigPermissionHandler({
			permission: {
				options: {
					path: './conf/permissions.yml',
					cacheEvacuationInterval: 60000
				}
			}
		});
		permissionHandler.setRecordHandler({ removeRecordRequest: () => {}, runWhenRecordStable: ( r, c ) => { c(); }});
		permissionHandler.init();
		permissionHandler.on( 'error', onError );
		expect( permissionHandler.isReady ).toBe( false );
		permissionHandler.on( 'error', function( error ){
			expect( 'it should not have had this ' + error ).toBe( true );
			next();
		});
		permissionHandler.on( 'ready', function(){
			expect( permissionHandler.isReady ).toBe( true );
			next();
		});
	});

	it( 'allows publishing of a private event', function( next ){
		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'private/event', 'somedata' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			next();
		};

		permissionHandler.canPerformAction( 'some-user', message, callback );
	});

	it( 'loads a new config', function( next ){
		var path = './test/test-configs/no-private-events-permission-config.json';

		permissionHandler.on( 'config-loaded', function( loadedPath ){
			expect( loadedPath ).toBe( path );
			setTimeout( next, 20 );
		});

		permissionHandler.loadConfig( path );
	});

	it( 'denies publishing of a private event', function( next ){
		expect( onError ).not.toHaveBeenCalled();

		var message = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			data: [ 'private/event', 'somedata' ]
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( false );
			next();
		};

		permissionHandler.canPerformAction( 'some-user', message, callback );
	});
});
