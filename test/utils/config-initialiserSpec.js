var defaultConfig = require( '../../src/default-options' );
var path = require( 'path' );

describe( 'plugins are initialised as per configuration', function(){
	var configInitialiser = require( '../../src/utils/config-initialiser' );

	it( 'loads plugins from a relative path', function(){
		var config = defaultConfig.get();
		config.plugins = {
			cache: {
				path: '../../test/test-plugins/plugin-a',
				options: { some: 'options' }
			}
		};
		configInitialiser.initialise( config, {} );
		expect( config.cache.type ).toBe( 'pluginA' );
		expect( config.cache.options ).toEqual({ some: 'options' });
	});

	it( 'loads plugins via module names', function(){
		var config = defaultConfig.get();
		config.plugins = {
			cache: {
				path: 'n0p3',
				options: {}
			}
		};
		configInitialiser.initialise( config, {} );
		expect( config.cache.toString() ).toBe( '[object Object]' );
	});

	it( 'loads plugins from a relative path', function(){
		var config = defaultConfig.get();
		config.plugins = {
			cache: {
				path: './plugin-a',
				options: { some: 'options' }
			}
		};
		configInitialiser.initialise( config, { l: './test/test-plugins' } );
		expect( config.cache.type ).toBe( 'pluginA' );
		expect( config.cache.options ).toEqual({ some: 'options' });
	});
});

describe( 'translates shortcodes into paths', function(){
	var configInitialiser = require( '../../src/utils/config-initialiser' );

	it( 'translates cache', function(){
		var config = defaultConfig.get();
		var errored = false;
		config.plugins = {
			cache: {
				name: 'blablub'
			}
		};
		try{
			configInitialiser.initialise( config, { l: '/foobar' } );
		} catch( e ) {
			errored = true;
			expect( e.toString() ).toContain( path.join( '/foobar', 'deepstream.io-cache-blablub' ) );
		}

		expect( errored ).toBe( true );
	});

	it( 'translates message connectors', function(){
		var config = defaultConfig.get();
		var errored = false;
		config.plugins = {
			message: {
				name: 'blablub'
			}
		};

		try{
			configInitialiser.initialise( config, { l: '/foobar' } );
		} catch( e ) {
			errored = true;
			expect( e.toString() ).toContain( path.join( '/foobar', 'deepstream.io-msg-blablub' ) );
		}

		expect( errored ).toBe( true );
	});

})