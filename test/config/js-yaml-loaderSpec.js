'use strict';
/* global jasmine, spyOn, describe, it, expect */

var proxyquire = require( 'proxyquire' );
var defaultOptions = require( '../../src/default-options' );
var utils = require( '../../src/utils/utils' );
var C = require( '../../src/constants/constants' );
var path = require( 'path' );

function setUpStub( fileExists, fileContent ) {
	var fileMock = {};
	if( typeof fileExists !== 'undefined' ) {
		fileMock.fileExistsSync = function() {
			return !!fileExists;
		};
	}
	var fsMock = {};
	if( typeof fileContent !== 'undefined' ) {
		fsMock.readFileSync = function() {
			return fileContent;
		};
	}

	var configLoader = proxyquire( '../../src/config/js-yaml-loader', {
		'./file-utils': fileMock,
		'fs': fsMock
	} );
	spyOn( fileMock, 'fileExistsSync' ).and.callThrough();
	spyOn( fsMock, 'readFileSync' ).and.callThrough();
	return {
		configLoader: configLoader,
		fileMock: fileMock,
		fsMock: fsMock
	};

}

describe( 'js-yaml-loader', function() {

	afterAll( function() {
		global.deepstreamConfDir = null;
		global.deepstreamLibDir = null;
		global.deepstreamCLI = null;
	} );

	describe( 'js-yaml-loader loads and parses json files', function(){
		var jsYamlLoader = require( '../../src/config/js-yaml-loader' );

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
			var loader = require( '../../src/config/js-yaml-loader' );
			var result = loader.loadConfig();
			var defaultYamlConfig = result.config;

			expect( result.file ).toEqual( path.join( 'conf', 'config.yml' ) );


			expect( defaultYamlConfig.serverName ).toEqual( jasmine.any( String ) );
			defaultYamlConfig = utils.merge( defaultYamlConfig, {
				permission: { type: 'none', options: null },
				permissionHandler: null,
				authenticationHandler: null,
				plugins: null,
				serverName: null,
				logger: null
			} );
			var defaultConfig = utils.merge( defaultOptions.get(), {
				permission: { type: 'none', options: null },
				permissionHandler: null,
				authenticationHandler: null,
				plugins: null,
				serverName: null,
				logger: null
			} );
			// console.log(JSON.stringify(defaultYamlConfig, null, 1))
			// console.log(JSON.stringify(defaultConfig, null, 1))
			expect( defaultYamlConfig ).toEqual( defaultConfig );
		} );

		it( 'tries to load yaml, js and json file and then default', function() {
			var stub = setUpStub( false );

			expect(function(){
				stub.configLoader.loadConfig();
			}).toThrow();

			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 12 );

			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( path.join( 'conf', 'config.js' ) );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( path.join( 'conf', 'config.json' ) );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( path.join( 'conf', 'config.yml' ) );

			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( '/etc/deepstream/config.js' );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( '/etc/deepstream/config.json' );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( '/etc/deepstream/config.yml' );
		} );

		it( 'load a custom yml file path', function() {
			var stub = setUpStub();
			var config = stub.configLoader.loadConfig( './test/test-configs/config.yml' ).config;
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 1 );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( './test/test-configs/config.yml' );
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
			var stub = setUpStub();
			expect(function(){
				stub.configLoader.loadConfig( null, {config:'./test/test-configs/does-not-exist.yml'} )
			}).toThrowError( 'Configuration file not found at: ./test/test-configs/does-not-exist.yml' );
		} );

		it( 'load a custom json file path', function() {
			var stub = setUpStub( true, JSON.stringify( {port: 1001} ) );
			var config = stub.configLoader.loadConfig( null, {config: './foo.json'} ).config;
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 1 );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( './foo.json' );
			expect( config.port ).toEqual( 1001 );
		} );

		it( 'load a custom js file path', function() {
			var stub = setUpStub();

			var config = stub.configLoader.loadConfig( null, {config:'./test/test-configs/config.js'} ).config;
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 1 );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( './test/test-configs/config.js' );
			expect( config.port ).toEqual( 1002 );

			config = stub.configLoader.loadConfig( null, {config:path.join( process.cwd(), 'test/test-configs/config.js' )} ).config;
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 2 );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( path.join( process.cwd(), 'test/test-configs/config.js' ) );
			expect( config.port ).toEqual( 1002 );
		} );

		it( 'fails if the custom file format is not supported', function() {
			var stub = setUpStub( true, 'content doesnt matter here' );
			expect( function() {
				stub.configLoader.loadConfig( null, {config:'./config.foo'} ).config;
			} ).toThrowError( '.foo is not supported as configuration file' );
		} );

		it( 'fails if the custom file was not found', function() {
			var stub = setUpStub( false );
			expect( function() {
				stub.configLoader.loadConfig( null, {config:'./not-existing-config'} ).config;
			} ).toThrowError( 'Configuration file not found at: ./not-existing-config' );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 1 );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( './not-existing-config' );
		} );

		it( 'fails if the yaml file is invalid', function() {
			var stub = setUpStub();
			expect( function() {
				stub.configLoader.loadConfig( null, {config:'./test/test-configs/config-broken.yml'} ).config;
			} ).toThrowError( /asdsad: ooops/ );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 1 );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( './test/test-configs/config-broken.yml' );
		} );

		it( 'fails if the js file is invalid', function() {
			var stub = setUpStub();
			expect( function() {
				stub.configLoader.loadConfig( null, {config:'./test/test-configs/config-broken.js'} ).config;
			} ).toThrowError( /foobarBreaksIt is not defined/ );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledTimes( 1 );
			expect( stub.fileMock.fileExistsSync ).toHaveBeenCalledWith( './test/test-configs/config-broken.js' );
		} );
	} );

	describe( 'supports environment variable substitution', function() {
		var configLoader;

		beforeAll( function() {
			process.env.ENVIRONMENT_VARIABLE_TEST_1 = "an_environment_variable_value";
			process.env.ENVIRONMENT_VARIABLE_TEST_2 = "another_environment_variable_value";
			process.env.EXAMPLE_HOST = "host";
			process.env.EXAMPLE_PORT = 1234;
			configLoader = require( '../../src/config/js-yaml-loader' );
		} );

		it( 'does environment variable substitution for yaml', function() {
			var config = configLoader.loadConfig( null, {config:'./test/test-configs/config.yml'} ).config;
			expect( config.environmentvariable ).toBe( 'an_environment_variable_value' );
			expect( config.another.environmentvariable ).toBe( 'another_environment_variable_value' );
			expect( config.thisenvironmentdoesntexist ).toBe( 'DOESNT_EXIST' );
			expect( config.multipleenvs ).toBe( 'host:1234' );
		} );

		it( 'does environment variable substitution for json', function() {
			var config = configLoader.loadConfig( null, {config:'./test/test-configs/json-with-env-variables.json'} ).config;
			expect( config.environmentvariable ).toBe( 'an_environment_variable_value' );
			expect( config.another.environmentvariable ).toBe( 'another_environment_variable_value' );
			expect( config.thisenvironmentdoesntexist ).toBe( 'DOESNT_EXIST' );
			expect( config.multipleenvs ).toBe( 'host:1234' );
		} );

	} );

	describe( 'merges in deepstreamCLI options', function() {
		var configLoader;

		beforeAll( function() {
			global.deepstreamCLI = {
				webServerEnabled: false,
				port: 5555
			};
			configLoader = require( '../../src/config/js-yaml-loader' );
		} );

		afterAll( function() {
			delete process.env.deepstreamCLI;
		} );

		it( 'does environment variable substitution for yaml', function() {
			var config = configLoader.loadConfig().config;
			expect( config.webServerEnabled ).toBe( false );
			expect( config.port ).toBe( 5555 );
		} );

	} );

	describe( 'load plugins by relative path property', function() {
		var config;
		beforeAll( function() {
			var fileMock = {
				fileExistsSync: function() {
					return true;
				}
			}
			var fsMock = {
				readFileSync: function( filePath ) {
					if ( filePath === './config.json' ) {
						return `{
							"plugins": {
								"logger": {
									"path": "./logger"
								},
								"message": {
									"path": "./message",
									"options": { "foo": 3, "bar": 4 }
								}
							}
						}`;
					} else {
						throw new Error( 'should not require any other file: ' + filePath );
					}
				}
			};
			var loggerModule = function( options ) { return options; };
			loggerModule['@noCallThru'] = true;
			loggerModule['@global'] = true;
			class MessageModule { constructor( options ) {this.options = options; }}
			MessageModule['@noCallThru'] = true;
			MessageModule['@global'] = true;
			var configLoader = proxyquire( '../../src/config/js-yaml-loader', {
				fs: fsMock,
				'./file-utils': fileMock,
				[path.resolve( './logger' )]: loggerModule,
				[path.resolve( './message' )]: MessageModule
			} );
			config = configLoader.loadConfig( null, {config:'./config.json'} ).config;
		} );

		it( 'load plugins', function() {
			expect( config.messageConnector.options ).toEqual( {foo: 3, bar: 4} );
		} );

	} );

	describe( 'load plugins by path property (npm module style)', function() {
		var config;
		beforeAll( function() {
			var fileMock = {
				fileExistsSync: function() {
					return true;
				}
			}
			var fsMock = {
				readFileSync: function( filePath ) {
					if ( filePath === './config.json' ) {
						return `{
							"plugins": {
								"cache": {
									"path": "foo-bar-qox",
									"options": { "foo": 3, "bar": 4 }
								}
							}
						}`;
					} else {
						throw new Error( 'should not require any other file: ' + filePath );
					}
				}
			};
			class FooBar {
				constructor( options ) { this.options = options; }
			}
			FooBar['@noCallThru'] = true;
			FooBar['@global'] = true;
			var configLoader = proxyquire( '../../src/config/js-yaml-loader', {
				fs: fsMock,
				'./file-utils': fileMock,
				'foo-bar-qox': FooBar
			} );
			config = configLoader.loadConfig( null, {config:'./config.json'} ).config;
		} );

		it( 'load plugins', function() {
			expect( config.cache.options ).toEqual( {foo: 3, bar: 4} );
		} );
	} );

	describe( 'load plugins by name with a name convention', function() {
		var config;
		beforeAll( function() {
			var fileMock = {
				fileExistsSync: function() {
					return true;
				}
			}
			var fsMock = {
				readFileSync: function( filePath ) {
					if ( filePath === './config.json' ) {
						return `{
							"plugins": {
								"message": {
									"name": "super-messager",
									"options": { "foo": 5, "bar": 6 }
								},
								"storage": {
									"name": "super-storage",
									"options": { "foo": 7, "bar": 8 }
								}
							}
						}`;
					} else {
						throw new Error( 'should not require any other file: ' + filePath );
					}
				}
			};
			class SuperMessager {
				constructor( options ) { this.options = options; }
			}
			SuperMessager['@noCallThru'] = true;
			SuperMessager['@global'] = true;
			class SuperStorage {
				constructor( options ) { this.options = options; }
			}
			SuperStorage['@noCallThru'] = true;
			SuperStorage['@global'] = true;
			var configLoader = proxyquire( '../../src/config/js-yaml-loader', {
				fs: fsMock,
				'./file-utils': fileMock,
				'deepstream.io-msg-super-messager': SuperMessager,
				'deepstream.io-storage-super-storage': SuperStorage
			} );
			config = configLoader.loadConfig( null, {
				config: './config.json'
			} ).config;
		} );

		it( 'load plugins', function() {
			expect( config.messageConnector.options ).toEqual( {foo: 5, bar: 6} );
			expect( config.storage.options ).toEqual( {foo: 7, bar: 8} );
		} );
	} );

	describe( 'load plugins by name with a name convention with lib prefix', function() {
		var config;
		beforeAll( function() {
			var fileMock = {
				fileExistsSync: function() {
					return true;
				}
			}
			var fsMock = {
				readFileSync: function( filePath ) {
					if ( filePath === './config.json' ) {
						return `{
							"plugins": {
								"message": {
									"name": "super-messager",
									"options": { "foo": -1, "bar": -2 }
								},
								"storage": {
									"name": "super-storage",
									"options": { "foo": -3, "bar": -4 }
								}
							}
						}`;
					} else {
						throw new Error( 'should not require any other file: ' + filePath );
					}
				}
			};
			class SuperMessager {
				constructor( options ) { this.options = options; }
			}
			SuperMessager['@noCallThru'] = true;
			SuperMessager['@global'] = true;
			class SuperStorage {
				constructor( options ) { this.options = options; }
			}
			SuperStorage['@noCallThru'] = true;
			SuperStorage['@global'] = true;
			var configLoader = proxyquire( '../../src/config/js-yaml-loader', {
				fs: fsMock,
				'./file-utils': fileMock,
				[path.resolve( process.cwd(), 'foobar', 'deepstream.io-msg-super-messager' )]: SuperMessager,
				[path.resolve( process.cwd(), 'foobar', 'deepstream.io-storage-super-storage' )]: SuperStorage
			} );
			config = configLoader.loadConfig( null, {
				config: './config.json',
				libDir: 'foobar'
			} ).config;
		} );

		it( 'load plugins', function() {
			expect( config.messageConnector.options ).toEqual( {foo: -1, bar: -2} );
			expect( config.storage.options ).toEqual( {foo: -3, bar: -4} );
		} );
	} );

	describe( 'load plugins by name with a name convention with an absolute lib prefix', function() {
		var config;
		beforeAll( function() {
			var fileMock = {
				fileExistsSync: function() {
					return true;
				}
			}
			var fsMock = {
				readFileSync: function( filePath ) {
					if ( filePath === './config.json' ) {
						return `{
							"plugins": {
								"message": {
									"name": "super-messager",
									"options": { "foo": -1, "bar": -2 }
								},
								"storage": {
									"name": "super-storage",
									"options": { "foo": -3, "bar": -4 }
								}
							}
						}`;
					} else {
						throw new Error( 'should not require any other file: ' + filePath );
					}
				}
			};
			class SuperMessager {
				constructor( options ) { this.options = options; }
			}
			SuperMessager['@noCallThru'] = true;
			SuperMessager['@global'] = true;
			class SuperStorage {
				constructor( options ) { this.options = options; }
			}
			SuperStorage['@noCallThru'] = true;
			SuperStorage['@global'] = true;
			var configLoader = proxyquire( '../../src/config/js-yaml-loader', {
				fs: fsMock,
				'./file-utils': fileMock,
				[path.resolve( '/foobar', 'deepstream.io-msg-super-messager' )]: SuperMessager,
				[path.resolve( '/foobar', 'deepstream.io-storage-super-storage' )]: SuperStorage
			} );
			config = configLoader.loadConfig( null, {
				config: './config.json',
				libDir: '/foobar'
			} ).config;
		} );

		it( 'load plugins', function() {
			expect( config.messageConnector.options ).toEqual( {foo: -1, bar: -2} );
			expect( config.storage.options ).toEqual( {foo: -3, bar: -4} );
		} );

	} );
} );
