/* global describe, it, expect, jasmine */
var DependencyInitialiser = require( '../../src/utils/dependency-initialiser' ),
	PluginMock = require( '../mocks/plugin-mock' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	EventEmitter = require( 'events' ).EventEmitter;

xdescribe( 'dependency-initialiser', function(){
	var options = {
		pluginA: new PluginMock( 'A' ),
		pluginB: new PluginMock( 'B' ),
		pluginC: new PluginMock( 'C' ),
		logger: new LoggerMock(),
		dependencyInitialisationTimeout: 20
	};


	it( 'selects the correct plugin', function( done ){
		var dependencyInitialiser = new DependencyInitialiser( options, 'pluginB' );
		expect( dependencyInitialiser.getDependency().name ).toBe( 'B' );
		expect( options.logger.lastLogEvent ).toBe( null );
	});

	// TODO - Figure out what's going on with set timeout, then continue
});