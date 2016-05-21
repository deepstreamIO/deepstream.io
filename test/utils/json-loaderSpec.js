/* global describe, it, expect, jasmine */
var JsonLoader = require( '../../src/utils/json-loader' );

describe( 'json loader loads and parses json files', function(){
	var jsonLoader;

	it( 'initialises the loader', function(){
		jsonLoader = new JsonLoader();
		expect( typeof jsonLoader.load ).toBe( 'function' );
	});

	it( 'errors if invoked with an invalid path', function( done ){
		jsonLoader.load( null, ( err, result ) => {
			expect( err ).toBe( 'invalid path null' );
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
			expect( err ).toContain( 'error while loading config' );
			done();
		});
	});

	it( 'errors when trying to load invalid json', function( done ){
		jsonLoader.load( './test/test-configs/broken-json-config.json', ( err, result ) => {
			expect( err ).toContain( 'error while parsing config' );
			done();
		});
	});
});