/* global jasmine, spyOn, describe, it, expect */

var proxyquire = require( 'proxyquire' );
var defaultOptions = require( '../../src/default-options' );
var merge = require( 'lodash.merge' );
var C = require( '../../src/constants/constants' );
var path = require( 'path' );

describe( 'js-yaml-loader', function() {

	it( 'loads the default yml file', function() {
		var loader = require( '../../src/utils/js-yaml-loader' );
		var result = loader.loadConfig();
		var defaultYamlConfig = result.config;
		expect( result.file ).toEqual( 'config.yml' );
		expect( defaultYamlConfig.serverName ).toEqual( jasmine.any( String ) );
		defaultYamlConfig = merge( defaultYamlConfig, {
			permissionHandler: null,
			plugins: null,
			serverName: null
		} );
		var defaultConfig = merge( defaultOptions.get(), {
			permissionHandler: null,
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
		configLoader.loadConfig().config;
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 3 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( 'config.js' );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( 'config.js' );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( 'config.yml' );
	} );

	it( 'load a custom yml file path', function() {
		var fsMock = {};

		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock
		} );
		spyOn( fsMock, 'lstatSync' ).and.callThrough();
		var config = configLoader.loadConfig( './test/test-configs/config.yml' ).config;
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
		var config = configLoader.loadConfig( './foo.json' ).config;
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
		var config = configLoader.loadConfig( './test/test-configs/config.js' ).config;
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './test/test-configs/config.js' );
		expect( config.port ).toEqual( 1002 );

		config = configLoader.loadConfig( path.join( process.cwd(), 'test/test-configs/config.js' ) ).config;
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 2 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( path.join( process.cwd(), 'test/test-configs/config.js' ) );
		expect( config.port ).toEqual( 1002 );
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
			configLoader.loadConfig( './not-existing-config' ).config;
		} ).toThrow();
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
			configLoader.loadConfig( './test/test-configs/config-broken.yml' ).config;
		} ).toThrow();
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
			configLoader.loadConfig( './test/test-configs/config-broken.js' ).config;
		} ).toThrow();
		expect( fsMock.lstatSync ).toHaveBeenCalledTimes( 1 );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( './test/test-configs/config-broken.js' );
	} );

} );
