/* global describe, it, expect, jasmine */

var path = require( 'path' );
var utils = require( '../../src/utils/utils' );
var EventEmitter = require( 'events' ).EventEmitter;

describe( 'utils', function(){

   it( 'receives a different value everytime getUid is called', function() {
		var uidA = utils.getUid(),
			uidB = utils.getUid(),
			uidC = utils.getUid();

		expect( uidA ).not.toBe( uidB );
		expect( uidB ).not.toBe( uidC );
		expect( uidA ).not.toBe( uidC );
   });

   it( 'combines multiple events into one', function() {
		var emitters = [
			new EventEmitter(),
			new EventEmitter(),
			new EventEmitter()
		],
		callback = jasmine.createSpy( 'eventCallback' );

		utils.combineEvents( emitters, 'someEvent', callback );
		expect( callback ).not.toHaveBeenCalled();

		emitters[ 0 ].emit( 'someEvent' );
		expect( callback ).not.toHaveBeenCalled();

		emitters[ 1 ].emit( 'someEvent' );
		emitters[ 2 ].emit( 'someEvent' );
		expect( callback ).toHaveBeenCalled();
   });

   it( 'reverses maps', function(){
		var user = {
			firstname: 'Wolfram',
			lastname: 'Hempel'
		};

		expect( utils.reverseMap( user ) ).toEqual({
			'Wolfram': 'firstname',
			'Hempel': 'lastname'
		});
   });
});

describe( 'deepCopy', function(){

	it( 'copies primitives', function(){
		expect( utils.deepCopy( 'bla' ) ).toBe( 'bla' );
		expect( utils.deepCopy( 42 ) ).toBe( 42 );
	});

	it( 'copies arrays', function(){
		var original = [ 'a', 'b', 2 ],
			copy = utils.deepCopy( original );

		expect( copy ).toEqual( original );
		expect( copy ).not.toBe( original );
	});

	it( 'copies objects', function(){
		var original = { firstname: 'Wolfram', lastname:' Hempel' },
			copy = utils.deepCopy( original );

		expect( copy ).toEqual( original );
		expect( copy ).not.toBe( original );
	});

	it( 'copies objects with null values', function(){
		var original = { firstname: 'Wolfram', lastname: null },
			copy = utils.deepCopy( original );

		expect( copy ).toEqual( original );
		expect( copy ).not.toBe( original );
	});

	it( 'copies null values', function(){
		var copy = utils.deepCopy( null );
		expect( copy ).toBeNull();
	});

	it( 'copies nested values', function(){
		var original = { a: { b: 'c', d: 4 } };
		var copy = utils.deepCopy( original );
		expect( original ).toEqual( copy );
		expect( original.a ).not.toBe( copy.a );
	});

	it( 'copies nested arrays', function(){
		var original = { a: { b: 'c', d: [ 'a', { x: 'y' }] } };
		var copy = utils.deepCopy( original );
		expect( original ).toEqual( copy );
		expect( original.a.d ).not.toBe( copy.a.d );
		expect( Array.isArray( copy.a.d ) ).toBe( true );
		expect( copy.a.d[ 1 ] ).toEqual( { x: 'y' });
		expect( original.a.d[ 1 ] === copy.a.d[ 1 ] ).toBe( false );
	});

	//This is a JSON.stringify specific behaviour. Not too sure it's ideal,
	//but it is something that will break behaviour when changed, so let's
	//keep an eye on it
	it( 'converts undefined', function(){
		var copy = utils.deepCopy([ undefined ]);
		expect( copy[ 0 ] ).toBe( null );

		copy = utils.deepCopy({ x: undefined });
		expect( copy ).toEqual( {} );
	});
});

describe( 'isOfType', function(){
	it( 'checks basic types', function(){
		expect( utils.isOfType( 'bla', 'string' ) ).toBe( true );
		expect( utils.isOfType( 42, 'string' ) ).toBe( false );
		expect( utils.isOfType( 42, 'number' ) ).toBe( true );
		expect( utils.isOfType( true, 'number' ) ).toBe( false );
		expect( utils.isOfType( true, 'boolean' ) ).toBe( true );
		expect( utils.isOfType( {}, 'object' ) ).toBe( true );
		expect( utils.isOfType( null, 'object' ) ).toBe( true );
		expect( utils.isOfType( [], 'object' ) ).toBe( true );
	});

	it( 'checks urls', function(){
		expect( utils.isOfType( 'bla', 'url' ) ).toBe( false );
		expect( utils.isOfType( 'bla:22', 'url' ) ).toBe( true );
		expect( utils.isOfType( 'https://deepstream.io/', 'url' ) ).toBe( true );
	});

	it( 'checks arrays', function(){
		expect( utils.isOfType( [], 'array' ) ).toBe( true );
		expect( utils.isOfType( {}, 'array' ) ).toBe( false );
	});
});

describe( 'validateMap', function(){
	function _map() {
		return {
			'a-string': 'bla',
			'a number': 42,
			'an array': [ 'yup' ]
		};
	}

	function _schema() {
		return {
			'a-string': 'string',
			'a number': 'number',
			'an array': 'array'
		};
	}

	it( 'validates basic maps', function(){
		var map = _map();
		var schema = _schema();
		expect( utils.validateMap( map, false, schema ) ).toBe( true );
	});

	it( 'fails validating an incorrect map', function(){
		var map = _map();
		var schema = _schema();
		schema[ 'an array' ] = 'number';
		var returnValue = utils.validateMap( map, false, schema );
		expect( returnValue instanceof Error ).toBe( true );
	});

	it( 'fails validating an incomplete map', function(){
		var map = _map();
		var schema = _schema();
		delete map[ 'an array' ];
		var returnValue = utils.validateMap( map, false, schema );
		expect( returnValue instanceof Error ).toBe( true );
	});

	it( 'throws errors', function(){
		var map = _map();
		var schema = _schema();
		schema[ 'an array' ] = 'number';
		expect(function(){
			utils.validateMap( map, true, schema );
		}).toThrow();
	});
});

describe( 'merges recoursively', function(){
	it( 'merges two simple objects', function(){
		var objA = {
			firstname: 'Homer',
			lastname: 'Simpson'
		};

		var objB = {
			firstname: 'Marge'
		};

		expect( utils.merge( objA, objB ) ).toEqual({
			firstname: 'Marge',
			lastname: 'Simpson'
		});
	});

	it( 'merges two nested objects', function(){
		var objA = {
			firstname: 'Homer',
			lastname: 'Simpson',
			children: {
				'Bart': {
					lastname: 'Simpson'
				}
			}
		};

		var objB = {
			firstname: 'Marge',
			children: {
				'Bart': {
					firstname: 'Bart'
				}
			}
		};

		expect( utils.merge( objA, objB ) ).toEqual({
			firstname: 'Marge',
			lastname: 'Simpson',
			children: {
				'Bart': {
					firstname: 'Bart',
					lastname: 'Simpson'
				}
			}
		});
	});

	it( 'merges multiple objects ', function(){
		var objA = {
			pets: {
				birds: [ 'parrot', 'dove' ]
			}

		};

		var objB = {
			jobs: {
				hunter: false
			}
		};

		var objC = {
			firstname: 'Egon'
		};

		expect( utils.merge( objA, objB, {}, objC ) ).toEqual({
			pets: {
				birds: [ 'parrot', 'dove' ]
			},
			jobs: {
				hunter: false
			},
			firstname: 'Egon'
		});
	});

	it( 'handles null and undefined values', function(){
		var objA = {
			pets: {
				dog: 1,
				cat: 2,
				ape: 3
			}

		};

		var objB = {
			pets: {
				cat: null,
				ape: undefined,
				zebra: 9
			}
		};

		expect( utils.merge( objA, objB ) ).toEqual({
			pets: {
				dog: 1,
				cat: null,
				ape: 3,
				zebra: 9
			}
		});

	});
});