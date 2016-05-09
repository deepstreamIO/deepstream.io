/* global describe, it, expect, jasmine */
var DependencyInitialiser = require( '../../src/utils/dependency-initialiser' ),
	PluginMock = require( '../mocks/plugin-mock' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	EventEmitter = require( 'events' ).EventEmitter;

describe( 'dependency-initialiser', function(){
	var dependencyBInitialiser;

	var options = {
		pluginA: new PluginMock( 'A' ),
		pluginB: new PluginMock( 'B' ),
		pluginC: new PluginMock( 'C' ),
		logger: new LoggerMock(),
		dependencyInitialisationTimeout: 10
	};

	it( 'selects the correct plugin', function(){
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
	var originalProcessExit = process.exit;
	var originalConsoleLog = console.log;
	var options = {
		plugin: new PluginMock( 'A' ),
		logger: { log: jasmine.createSpy( 'log' ), isReady: true },
		dependencyInitialisationTimeout: 1
	};

	it( 'disables process exit', function(){
		Object.defineProperty( process, 'exit', {
			value: exit
		});

		Object.defineProperty( console, 'error', {
			value: log
		});
	});

	it( 'creates a depdendency initialiser', function( next ){
		dependencyInitialiser = new DependencyInitialiser( options, 'plugin' );
		dependencyInitialiser.on( 'ready', onReady );
		expect( options.plugin.isReady ).toBe( false );
		setTimeout( next, 5 );
	});

	it( 'doesnt initialise a plugin in time', function(){
		expect( onReady ).not.toHaveBeenCalled();
		expect( exit ).toHaveBeenCalled();
		expect( options.logger.log ).toHaveBeenCalledWith(  3, 'PLUGIN_ERROR', 'plugin wasn\'t initialised in time' );
	});

	it( 'creates another depdendency initialiser', function( next ){
		dependencyInitialiser = new DependencyInitialiser( options, 'plugin' );
		dependencyInitialiser.on( 'ready', onReady );
		options.logger.isReady = false;
		options.plugin.emit( 'error', 'something went wrong' );
		setTimeout( next , 50 );
	});

	it( 'has logged the plugin error', function(){
		expect( exit ).toHaveBeenCalled();
		expect( onReady ).not.toHaveBeenCalled();
		expect( log ).toHaveBeenCalledWith(  'Error while initialising dependency' );
		expect( log ).toHaveBeenCalledWith(  'Error while initialising plugin: something went wrong' );
	});

	it( 'enables process exit', function(){
		Object.defineProperty( process, 'exit', {
			value: originalProcessExit
		});

		Object.defineProperty( console, 'error', {
			value: originalConsoleLog
		});
	});
});