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
		expect( result.file ).toEqual( 'config/config.yml' );
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
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( 'config/config.js' );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( 'config/config.js' );
		expect( fsMock.lstatSync ).toHaveBeenCalledWith( 'config/config.yml' );
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

describe( 'load plugins by relative path property', function() {
	var config;
	beforeAll( function() {
		var fsMock = {
			lstatSync: function() {
				return true;
			},
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
		class MessageModule { constructor( options ) {this.options = options; }}
		MessageModule['@noCallThru'] = true;
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock,
			'./logger': loggerModule,
			'./message': MessageModule
		} );
		config = configLoader.loadConfig( {config:'./config.json'} ).config;
	} );

	it( 'load the any plugin except the logger using new keyword', function() {
		expect( config.messageConnector.options ).toEqual( {foo: 3, bar: 4} );
	} );

	it( 'load the logger plugin without using new keyword', function() {
		expect( config.logger( {a: 1, b: 2} ) ).toEqual( {a: 1, b: 2} );
	} );

} );

describe( 'load plugins by path property (npm module style)', function() {
	var config;
	beforeAll( function() {
		var fsMock = {
			lstatSync: function() {
				return true;
			},
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
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock,
			'foo-bar-qox': FooBar
		} );
		config = configLoader.loadConfig( {config:'./config.json'} ).config;
	} );

	it( 'load the any plugin except the logger using new keyword', function() {
		expect( config.cache.options ).toEqual( {foo: 3, bar: 4} );
	} );
} );

describe( 'load plugins by name with a name convention', function() {
	var config;
	beforeAll( function() {
		var fsMock = {
			lstatSync: function() {
				return true;
			},
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
		class SuperStorage {
			constructor( options ) { this.options = options; }
		}
		SuperStorage['@noCallThru'] = true;
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock,
			'deepstream.io-msg-super-messager': SuperMessager,
			'deepstream.io-storage-super-storage': SuperStorage
		} );
		config = configLoader.loadConfig( {
			config: './config.json'
		} ).config;
	} );

	it( 'load the any plugin except the logger using new keyword', function() {
		expect( config.messageConnector.options ).toEqual( {foo: 5, bar: 6} );
		expect( config.storage.options ).toEqual( {foo: 7, bar: 8} );
	} );
} );

describe( 'load plugins by name with a name convention with lib prefix', function() {
	var config;
	beforeAll( function() {
		var fsMock = {
			lstatSync: function() {
				return true;
			},
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
		class SuperStorage {
			constructor( options ) { this.options = options; }
		}
		SuperStorage['@noCallThru'] = true;
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock,
			[path.join( process.cwd(), 'foobar', 'deepstream.io-msg-super-messager' )]: SuperMessager,
			[path.join( process.cwd(), 'foobar', 'deepstream.io-storage-super-storage' )]: SuperStorage
		} );
		config = configLoader.loadConfig( {
			config: './config.json',
			libPrefix: 'foobar'
		} ).config;
	} );

	it( 'load the any plugin except the logger using new keyword', function() {
		expect( config.messageConnector.options ).toEqual( {foo: -1, bar: -2} );
		expect( config.storage.options ).toEqual( {foo: -3, bar: -4} );
	} );
} );

describe( 'load plugins by name with a name convention with an absolute lib prefix', function() {
	var config;
	beforeAll( function() {
		var fsMock = {
			lstatSync: function() {
				return true;
			},
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
		class SuperStorage {
			constructor( options ) { this.options = options; }
		}
		SuperStorage['@noCallThru'] = true;
		var configLoader = proxyquire( '../../src/utils/js-yaml-loader', {
			fs: fsMock,
			[path.join( '/foobar', 'deepstream.io-msg-super-messager' )]: SuperMessager,
			[path.join( '/foobar', 'deepstream.io-storage-super-storage' )]: SuperStorage
		} );
		config = configLoader.loadConfig( {
			config: './config.json',
			libPrefix: '/foobar'
		} ).config;
	} );

	it( 'load the any plugin except the logger using new keyword', function() {
		expect( config.messageConnector.options ).toEqual( {foo: -1, bar: -2} );
		expect( config.storage.options ).toEqual( {foo: -3, bar: -4} );
	} );
} );

describe( 'js-yaml-loader finds files with supported file extensions', function(){
	var jsYamlLoader = require( '../../src/utils/js-yaml-loader' );

	it( 'finds a single existing file', function( done ){
		jsYamlLoader.getExistingFilePath( './test/test-configs/exists-test/a-json-file', function( error, existingPath ){
			expect( error ).toBe( null );
			expect( existingPath ).toBe( './test/test-configs/exists-test/a-json-file.json' );
			done();
		});
	});

	it( 'does not find a file with any of the supported extensions', function( done ){
		jsYamlLoader.getExistingFilePath( './test/test-configs/exists-test/does-not-exist', function( error, existingPath ){
			expect( error ).toBe( 'no file found at ./test/test-configs/exists-test/does-not-exist' );
			done();
		});
	});

	it( 'finds two possible files for a given base path', function( done ){
		jsYamlLoader.getExistingFilePath( './test/test-configs/exists-test/a-file', function( error, existingPath ){
			expect( error ).toBe( 'Ambiguous Filepaths: found both ./test/test-configs/exists-test/a-file.js and ./test/test-configs/exists-test/a-file.yml' );
			expect( existingPath ).not.toBeDefined();
			done();
		});
	});
});