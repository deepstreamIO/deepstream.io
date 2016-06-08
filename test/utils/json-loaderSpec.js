/* global describe, it, expect */
var jsYamlLoader = require( '../../src/utils/js-yaml-loader' );

describe( 'json loader loads and parses json files', function(){
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
