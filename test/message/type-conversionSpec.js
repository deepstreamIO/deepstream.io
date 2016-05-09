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

	it( 'throws errors for unknown types', function(){
		expect(function(){
			messageBuilder.typed( function(){} );
		}).toThrow();
	});
});

describe( 'variable types are serialized and deserialized correctly', function(){

	it( 'processes strings correctly', function(){
		var input = 'Wolfram',
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'SWolfram' );
		expect( messageParser.convertTyped( typed ) ).toBe( input );
	});

	it( 'processes objects correctly', function(){
		var input = { firstname: 'Wolfram' },
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'O{"firstname":"Wolfram"}' );
		expect( messageParser.convertTyped( typed ) ).toEqual( input );
	});

	it( 'processes arrays correctly', function(){
		var input = [ 'a', 'b', 'c' ],
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'O["a","b","c"]' );
		expect( messageParser.convertTyped( typed ) ).toEqual( input );
	});

	it( 'processes integers correctly', function(){
		var input = 42,
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'N42' );
		expect( messageParser.convertTyped( typed ) ).toBe( input );
	});

	it( 'processes floats correctly', function(){
		var input = 0.543,
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'N0.543' );
		expect( messageParser.convertTyped( typed ) ).toBe( input );
	});

	it( 'processes null values correctly', function(){
		var input = null,
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'L' );
		expect( messageParser.convertTyped( typed ) ).toBe( input );
	});

	it( 'processes Boolean true correctly', function(){
		var input = true,
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'T' );
		expect( messageParser.convertTyped( typed ) ).toBe( input );
	});

	it( 'processes Boolean false correctly', function(){
		var input = false,
			typed = messageBuilder.typed( input );

		expect( typed ).toBe( 'F' );
		expect( messageParser.convertTyped( typed ) ).toBe( input );
	});

	it( 'processes undefined correctly', function(){
		var typed = messageBuilder.typed();

		expect( typed ).toBe( 'U' );
		expect( messageParser.convertTyped( typed ) ).toBe( undefined );
	});
});