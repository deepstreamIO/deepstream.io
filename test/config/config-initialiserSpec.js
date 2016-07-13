/* globals describe, it, expect */

var defaultConfig = require( '../../src/default-options' );
var configInitialiser = require( '../../src/config/config-initialiser' );
var path = require( 'path' );

describe( 'config-initialiser', function() {

	beforeAll( function() {
		global.deepstreamConfDir = null;
		global.deepstreamLibDir = null;
		global.deepstreamCLI = null;
	})

	describe( 'plugins are initialised as per configuration', function() {

		it( 'loads plugins from a relative path', function() {
			var config = defaultConfig.get();
			config.plugins = {
				cache: {
					path: './test/test-plugins/plugin-a',
					options: { some: 'options' }
				}
			};
			configInitialiser.initialise( config );
			expect( config.cache.type ).toBe( 'pluginA' );
			expect( config.cache.options ).toEqual( { some: 'options' } );
		} );

		it( 'loads plugins via module names', function() {
			var config = defaultConfig.get();
			config.plugins = {
				cache: {
					path: 'n0p3',
					options: {}
				}
			};

			configInitialiser.initialise( config );
			expect( config.cache.toString() ).toBe( '[object Object]' );
		} );

		it( 'loads plugins from a relative path and lib dir', function() {
			global.deepstreamLibDir = './test/test-plugins';

			var config = defaultConfig.get();
			config.plugins = {
				cache: {
					path: './plugin-a',
					options: { some: 'options' }
				}
			};
			configInitialiser.initialise( config );
			expect( config.cache.type ).toBe( 'pluginA' );
			expect( config.cache.options ).toEqual({ some: 'options' } );
		} );
	} );

	describe( 'ssl files are loaded if provided', function() {

		it( 'fails with incorrect path passed in', function() {
			[ 'sslKey', 'sslCert', 'sslCa' ].forEach( function( key ) {
				var config = defaultConfig.get();
				config[ key ] = './does-not-exist';
				expect(function() {
					configInitialiser.initialise( config );
				} ).toThrowError();
			} );
		} );

		it( 'loads sslFiles from a relative path and a config prefix', function() {
			global.deepstreamConfDir = './test/test-configs';

			var config = defaultConfig.get();
			config.sslKey = './sslKey.pem';
			configInitialiser.initialise( config );
			expect( config.sslKey ).toBe( 'I\'m a key' );
		} );
	} );

	describe( 'translates shortcodes into paths', function() {

		it( 'translates cache', function() {
			global.deepstreamLibDir = '/foobar';
			var config = defaultConfig.get();
			var errored = false;
			config.plugins = {
				cache: {
					name: 'blablub'
				}
			};
			try{
				configInitialiser.initialise( config );
			} catch( e ) {
				errored = true;
				expect( e.toString() ).toContain( path.join( '/foobar', 'deepstream.io-cache-blablub' ) );
			}

			expect( errored ).toBe( true );
		} );

		it( 'translates message connectors', function() {
			global.deepstreamLibDir = '/foobar';
			var config = defaultConfig.get();
			var errored = false;
			config.plugins = {
				message: {
					name: 'blablub'
				}
			};

			try{
				configInitialiser.initialise( config );
			} catch( e ) {
				errored = true;
				expect( e.toString() ).toContain( path.join( '/foobar', 'deepstream.io-msg-blablub' ) );
			}

			expect( errored ).toBe( true );
		} );
	} );

	describe( 'creates the right authentication handler', function() {

		it( 'works for authtype: none', function() {
			var config = defaultConfig.get();

			config.auth = {
				type: 'none'
			};
			configInitialiser.initialise( config );
			expect( config.authenticationHandler.type ).toBe( 'none' );
		} );

		it( 'works for authtype: user', function() {
			global.deepstreamConfDir = './test/test-configs';
			var config = defaultConfig.get();

			config.auth = {
				type: 'file',
				options: {
					path: './users.json'
				}
			};
			configInitialiser.initialise( config );
			expect( config.authenticationHandler.type ).toContain( 'file using' );
			expect( config.authenticationHandler.type ).toContain( path.resolve( 'test/test-configs/users.json') );
		} );

		it( 'works for authtype: http', function() {
			var config = defaultConfig.get();

			config.auth = {
				type: 'http',
				options: {
					endpointUrl: 'http://some-url.com',
					permittedStatusCodes: [ 200 ],
					requestTimeout: 2000
				}
			};

			configInitialiser.initialise( config );
			expect( config.authenticationHandler.type ).toBe( 'http webhook to http://some-url.com' );
		} );

		it( 'fails for missing auth sections', function() {
			var config = defaultConfig.get();

			delete config.auth;

			expect(function() {
				configInitialiser.initialise( config );
			} ).toThrowError( 'No authentication type specified' );
		} );

		it( 'fails for unknown auth types', function() {
			var config = defaultConfig.get();

			config.auth = {
				type: 'bla',
				options: {}
			};

			expect(function() {
				configInitialiser.initialise( config );
			} ).toThrowError( 'Unknown authentication type bla' );
		} );

		it( 'overrides with type "none" when disableAuth is set', function() {
			global.deepstreamCLI = { disableAuth: true };
			var config = defaultConfig.get();

			config.auth = {
				type: 'http',
				options: {}
			};

			configInitialiser.initialise( config );
			expect( config.authenticationHandler.type ).toBe( 'none' );
			delete global.deepstreamCLI;
		} );
	} );

	describe( 'creates the permissionHandler', function() {

		it( 'creates the config permission handler', function() {
			global.deepstreamConfDir = './test/test-configs';
			var config = defaultConfig.get();

			config.permission = {
				type: 'config',
				options: {
					path: './basic-permission-config.json'
				}
			};
			configInitialiser.initialise( config );
			expect( config.permissionHandler.type ).toContain( 'valve permissions loaded from' );
			expect( config.permissionHandler.type ).toContain( path.resolve( 'test/test-configs/basic-permission-config.json') );
		} );

		it( 'fails for invalid permission types', function() {
			var config = defaultConfig.get();

			config.permission = {
				type: 'does-not-exist',
				options: {
					path: './test/test-configs/basic-permission-config.json'
				}
			};
			expect(function() {
				configInitialiser.initialise( config );
			} ).toThrowError( 'Unknown permission type does-not-exist' );

		} );

		it( 'fails for missing permission configs', function() {
			var config = defaultConfig.get();
			delete config.permission;

			expect(function() {
				configInitialiser.initialise( config );
			} ).toThrowError( 'No permission type specified' );
		} );

		it( 'overrides with type "none" when disablePermissions is set', function() {
			global.deepstreamCLI = { disablePermissions: true };
			var config = defaultConfig.get();

			config.permission = {
				type: 'config',
				options: {}
			};

			configInitialiser.initialise( config );
			expect( config.permissionHandler.type ).toBe( 'none' );
			delete global.deepstreamCLI;
		} );
	} );

	describe( 'supports custom loggers', function() {

		it( 'load the default logger with options', function() {
			global.deepstreamLibDir = null;
			var config = defaultConfig.get();

			config.logger = {
				name: 'default',
				options: {
					logLevel: 2
				}
			};
			configInitialiser.initialise( config );
			expect( config.logger._options ).toEqual( {logLevel: 2} );
		} );

		it( 'load a custom logger', function() {
			global.deepstreamLibDir = null;
			var config = defaultConfig.get();

			config.logger = {
				path: './test/test-helper/custom-logger',
				options: {
					a: 1
				}
			};
			configInitialiser.initialise( config );
			expect( config.logger.options ).toEqual( {a: 1} );
		} );

		it( 'throw an error for a unsupported logger type', function( next ) {
			var config = defaultConfig.get();

			config.logger = {
				norNameNorPath: 'foo',
			};
			try {
				configInitialiser.initialise( config );
				next.fail( 'should fail' );
			} catch ( err ) {
				expect( err.toString() ).toContain( 'Neither name nor path property found' );
				next();
			}
		} );
	} );
} );
