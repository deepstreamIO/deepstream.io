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
});

describe( 'creates the right authentication handler', function(){
	var configInitialiser = require( '../../src/utils/config-initialiser' );

	it( 'works for authtype: none', function(){
		var config = defaultConfig.get();

		config.auth = {
			type: 'none'
		};
		configInitialiser.initialise( config, {} );
		expect( config.authenticationHandler.type ).toBe( 'none' );
	});

	it( 'works for authtype: http', function(){
		var config = defaultConfig.get();

		config.auth = {
			type: 'http',
			options: {
				endpointUrl: 'http://some-url.com',
				permittedStatusCodes: [ 200 ],
				requestTimeout: 2000
			}
		};

		configInitialiser.initialise( config, {} );
		expect( config.authenticationHandler.type ).toBe( 'http webhook to http://some-url.com' );
	});

	it( 'fails for missing auth sections', function(){
		var config = defaultConfig.get();

		delete config.auth;

		expect(function(){
			configInitialiser.initialise( config, {} );
		}).toThrowError( 'No authentication type specified' );
	});

	it( 'fails for unknown auth types', function(){
		var config = defaultConfig.get();

		config.auth = {
			type: 'bla',
			options: {}
		};

		expect(function(){
			configInitialiser.initialise( config, {} );
		}).toThrowError( 'Unknown authentication type bla' );
	});

	it( 'overrides with type "none" when disableAuth is set', function(){
		process.deepstreamCLI = { disableAuth: true };
		var config = defaultConfig.get();

		config.auth = {
			type: 'http',
			options: {}
		};

		configInitialiser.initialise( config, {} );
		expect( config.authenticationHandler.type ).toBe( 'none' );
		delete process.deepstreamCLI;
	});
});

describe( 'creates the permissionHandler', function(){
	var configInitialiser = require( '../../src/utils/config-initialiser' );

	it( 'creates the config permission handler', function(){
		var config = defaultConfig.get();

		config.permission = {
			type: 'config',
			options: {
				path: './test/test-configs/basic-permission-config.json'
			}
		};
		configInitialiser.initialise( config, {} );
		expect( config.permissionHandler.type ).toBe( 'valve permissions loaded from ./test/test-configs/basic-permission-config.json' );
	});

	it( 'fails for invalid permission types', function(){
		var config = defaultConfig.get();

		config.permission = {
			type: 'does-not-exist',
			options: {
				path: './test/test-configs/basic-permission-config.json'
			}
		};
		expect(function(){
			configInitialiser.initialise( config, {} );
		}).toThrowError( 'Unknown permission type does-not-exist' );

	});

	it( 'fails for missing permission configs', function(){
		var config = defaultConfig.get();
		delete config.permission;

		expect(function(){
			configInitialiser.initialise( config, {} );
		}).toThrowError( 'No permission type specified' );
	});

	xit( 'overrides with type "none" when disablePermissions is set', function(){
		process.deepstreamCLI = { disablePermissions: true };
		var config = defaultConfig.get();

		config.permission = {
			type: 'config',
			options: {}
		};

		configInitialiser.initialise( config, {} );
		expect( config.permissionHandler.type ).toBe( 'none' );
		delete process.deepstreamCLI;
	});
});