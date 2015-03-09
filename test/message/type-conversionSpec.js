var messageBuilder = require( '../../src/message/message-builder' ),
	messageParser = require( '../../src/message/message-parser' );

/* global it, describe, expect */	
describe( 'variable types are serialized and deserialized correctly', function(){
	
	// Types
	it( 'processes strings correctly', function(){
		expect( messageParser.convertTyped( 'SWolfram' ) ).toBe( 'Wolfram' );
	});
	
	it( 'processes objects correctly', function(){
		expect( messageParser.convertTyped( 'O{"firstname":"Wolfram"}' ) ).toEqual( { firstname: 'Wolfram' } );
	});
	
	it( 'processes arrays correctly', function(){
		expect( messageParser.convertTyped( 'O["a","b","c"]' ) ).toEqual( [ 'a', 'b', 'c' ] );
	});
	
	it( 'processes integers correctly', function(){
		expect( messageParser.convertTyped( 'N42' ) ).toBe( 42 );
	});
	
	it( 'processes floats correctly', function(){
		expect( messageParser.convertTyped( 'N0.543' ) ).toBe( 0.543 );
	});
	
	it( 'processes null values correctly', function(){
		expect( messageParser.convertTyped( 'L' ) ).toBe( null );
	});
	
	it( 'processes Boolean true correctly', function(){
		expect( messageParser.convertTyped( 'T' ) ).toBe( true );
	});
	
	it( 'processes Boolean false correctly', function(){
		expect( messageParser.convertTyped( 'F' ) ).toBe( false );
	});
		
	it( 'processes undefined correctly', function(){
		expect( messageParser.convertTyped( 'U' ) ).toBe( undefined );
	});
	
	// Errors
	it( 'handles invalid JSON', function() {
	   	expect( messageParser.convertTyped( 'O{"firstname""Wolfram"}' ) instanceof Error ).toBe( true );
	});
	
	it( 'handles unknown types', function() {
	   	expect( messageParser.convertTyped( 'Qxxx' ) instanceof Error ).toBe( true );
	});
	
});