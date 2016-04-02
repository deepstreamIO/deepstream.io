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
		dependencyInitialisationTimeout: 20
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