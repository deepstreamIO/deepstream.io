/* global describe, it, expect, jasmine */
var C = require( '../../src/constants/constants' ),
  DependencyInitialiser = require( '../../src/utils/dependency-initialiser' ),
	PluginMock = require( '../mocks/plugin-mock' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	EventEmitter = require( 'events' ).EventEmitter;

describe( 'dependency-initialiser', function(){
	var dependencyInitialiser;
	var dependencyBInitialiser;

	var options = {
		pluginA: new PluginMock( 'A' ),
		pluginB: new PluginMock( 'B' ),
		pluginC: new PluginMock( 'C' ),
		brokenPlugin: {},
		logger: new LoggerMock(),
		dependencyInitialisationTimeout: 10
	};

	it( 'throws an error if dependency doesnt implement emitter or has isReady', function(){
		expect(function(){
			new DependencyInitialiser( options, 'brokenPlugin' );
		}).toThrow();
		expect( options.logger.lastLogEvent ).toBe( C.EVENT.PLUGIN_INITIALIZATION_ERROR );
	});

	it( 'selects the correct plugin', function(){
		options.logger.lastLogEvent = null;
		dependencyBInitialiser = new DependencyInitialiser( options, 'pluginB' );
		expect( dependencyBInitialiser.getDependency().name ).toBe( 'B' );
		expect( options.logger.lastLogEvent ).toBe( null );
	});

	it( 'notifies when the plugin is ready', function( done ){
		var readySpy = jasmine.createSpy();
		dependencyBInitialiser.on( 'ready', readySpy );

		options.pluginB.setReady();

		setTimeout( function() {
			expect( options.logger.lastLogEvent ).toBe( 'INFO' );
			expect( readySpy.calls.count() ).toBe( 1 );
			done();
		}, 5 );
	});
});

describe( 'encounters timeouts and errors during dependency initialisations', function(){
	var dependencyInitialiser;
	var readySpy;
	var onReady = jasmine.createSpy( 'onReady' );
	var exit = jasmine.createSpy( 'exit');
	var log = jasmine.createSpy( 'log' );
	var originalConsoleLog = console.log;
	var options = {
		plugin: new PluginMock( 'A' ),
		logger: { log: jasmine.createSpy( 'log' ), isReady: true },
		dependencyInitialisationTimeout: 1
	};

	it( 'disables console.error', function(){

		Object.defineProperty( console, 'error', {
			value: log
		});
	});

	it( 'creates a depdendency initialiser and doesnt initialise a plugin in time', function( next ){
		dependencyInitialiser = new DependencyInitialiser( options, 'plugin' );
		dependencyInitialiser.on( 'ready', onReady );
		expect( options.plugin.isReady ).toBe( false );
		process.once( 'uncaughtException', function() {
			expect( options.logger.log ).toHaveBeenCalledWith(  3, 'PLUGIN_ERROR', 'plugin wasn\'t initialised in time' );
			next();
		} );
		expect( onReady ).not.toHaveBeenCalled();

	});

	it( 'creates another depdendency initialiser with a plugin error', function( next ){
		process.once( 'uncaughtException', function(err) {
			expect( onReady ).not.toHaveBeenCalled();
			expect( log ).toHaveBeenCalledWith(  'Error while initialising dependency' );
			expect( log ).toHaveBeenCalledWith(  'Error while initialising plugin: something went wrong' );
			next();
		} );
		dependencyInitialiser = new DependencyInitialiser( options, 'plugin' );
		dependencyInitialiser.on( 'ready', onReady );
		options.logger.isReady = false;
		try {
			options.plugin.emit( 'error', 'something went wrong' );
			next.fail();
		} catch (_err) {}
	});

	it( 'enable console.error', function(){
		Object.defineProperty( console, 'error', {
			value: originalConsoleLog
		});
	});
});
