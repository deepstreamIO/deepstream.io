'use strict';
/* global jasmine, spyOn, describe, it, expect */

var proxyquire = require( 'proxyquire' );
var defaultOptions = require( '../../src/default-options' );
var utils = require( '../../src/utils/utils' );
var C = require( '../../src/constants/constants' );
var path = require( 'path' );

describe( 'js-yaml-loader loads and parses json files', function(){
	var jsYamlLoader = require( '../../src/utils/js-yaml-loader' );

	var jsonLoader = {
		load: jsYamlLoader.readAndParseFile
	};

	it( 'initialises the loader', function(){
		expect( typeof jsonLoader.load ).toBe( 'function' );
	});

	it( 'errors if invoked with an invalid path', function( done ){
		jsonLoader.load( null, ( err, result ) => {
			expect( err.toString() ).toContain( 'path must be a string' );
			done();
		});
	});

	it( 'successfully loads and parses a valid JSON file', function( done ){
		jsonLoader.load( './test/test-configs/basic-valid-json.json', ( err, result ) => {
			expect( err ).toBe( null );
			expect( result ).toEqual({ pet: 'pug' });
			done();
		});
	});

	it( 'errors when trying to load non existant file', function( done ){
		jsonLoader.load( './test/test-configs/does-not-exist.json', ( err, result ) => {
			expect( err.toString() ).toContain( 'no such file or directory' );
			done();
		});
	});

	it( 'errors when trying to load invalid json', function( done ){
		jsonLoader.load( './test/test-configs/broken-json-config.json', ( err, result ) => {
			expect( err.toString() ).toContain( 'Unexpected token' );
			done();
		});
	});
});


describe( 'js-yaml-loader', function() {

	it( 'loads the default yml file', function() {
		var loader = require( '../../src/utils/js-yaml-loader' );
		var result = loader.loadConfig();
		var defaultYamlConfig = result.config;
		expect( result.file ).toContain( 'config.yml' );
		expect( defaultYamlConfig.serverName ).toEqual( jasmine.any( String ) );
		defaultYamlConfig = utils.merge( defaultYamlConfig, {
			permission: { type: 'config', options: { path: null } },
			permissionHandler: null,
			authenticationHandler: null,
			plugins: null,
			serverName: null
		} );
		var defaultConfig = utils.merge( defaultOptions.get(), {
			permission: { type: 'config', options: { path: null } },
			permissionHandler: null,
			authenticationHandler: null,
			plugins: null,
			serverName: null
		} );
		expect( defaultYamlConfig ).toEqual( defaultConfig );
	} );

	it( 'tries to load yaml, js and json file and then default', function() {
		var fsMock = {
			lstatSync: function() {
				throw new Error( 'file does not exist' );
			}
		};
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		expect(function(){
			configLoader.loadConfig();
		}).toThrow();

		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 3 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( path.join( 'config', 'config.js' ) );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( path.join( 'config', 'config.json' ) );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( path.join( 'config', 'config.yml' ) );
	} );

	it( 'load a custom yml file path', function() {
		var fsMock = {};

		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		var config = configLoader.loadConfig( {config:'./test/test-configs/config.yml'} ).config;
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './test/test-configs/config.yml' );
		expect( config.serverName ).toBeDefined();
		expect( config.serverName ).not.toEqual( '' );
		expect( config.serverName ).not.toEqual( 'UUID' );
		expect( config.port ).toEqual( 1337 );
		expect( config.host ).toEqual( '1.2.3.4' );
		expect( config.colors ).toEqual( false );
		expect( config.showLogo ).toEqual( false );
		expect( config.logLevel ).toEqual( C.LOG_LEVEL.ERROR );
	} );

	it( 'loads a missing custom yml file path', function() {
		var fsMock = {};

		var configLoader = require( '../../src/utils/js-yaml-loader' );
		expect(function(){
			configLoader.loadConfig( {config:'./test/test-configs/does-not-exist.yml'} )
		}).toThrowError( 'configuration file not found at: ./test/test-configs/does-not-exist.yml' );
	
	} );

	it( 'load a custom json file path', function() {
		var fsMock = {
			lstatSync: function() {},
			readFileSync: function() {
				return JSON.stringify( {port: 1001} );
			}
		};
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		var config = configLoader.loadConfig( {config: './foo.json'} ).config;
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './foo.json' );
		expect( config.port ).toEqual( 1001 );
	} );

	it( 'load a custom js file path', function() {
		var fsMock = {
			lstatSync: function() {}
		};
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		var config = configLoader.loadConfig( {config:'./test/test-configs/config.js'} ).config;
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './test/test-configs/config.js' );
		expect( config.port ).toEqual( 1002 );

		config = configLoader.loadConfig( {config:path.join( process.cwd(), 'test/test-configs/config.js' )} ).config;
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 2 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( path.join( process.cwd(), 'test/test-configs/config.js' ) );
		expect( config.port ).toEqual( 1002 );
	} );

	it( 'fails if the custom file format is not supported', function() {
		var fsMock = {
			lstatSync: function() {
				return true;
			},
			readFileSync: function() {}
		};
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		expect( function() {
			configLoader.loadConfig( {config:'./config.foo'} ).config;
		} ).toThrowError( '.foo is not supported as configuration file' );
	} );

	it( 'fails if the custom file was not found', function() {
		var fsMock = {
			lstatSync: function() {
				throw new Error();
			}
		};
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		expect( function() {
			configLoader.loadConfig( {config:'./not-existing-config'} ).config;
		} ).toThrowError( 'configuration file not found at: ./not-existing-config' );
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './not-existing-config' );
	} );

	it( 'fails if the yaml file is invalid', function() {
		var fsMock = {};
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		expect( function() {
			configLoader.loadConfig( {config:'./test/test-configs/config-broken.yml'} ).config;
		} ).toThrowError( /asdsad: ooops/ );
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './test/test-configs/config-broken.yml' );
	} );

	it( 'fails if the js file is invalid', function() {
		var fsMock = {};
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		expect( function() {
			configLoader.loadConfig( {config:'./test/test-configs/config-broken.js'} ).config;
		} ).toThrowError( /foobarBreaksIt is not defined/ );
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './test/test-configs/config-broken.js' );
	} );

} );