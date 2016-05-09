/* global it, describe, expect */
var JsonPath = require( '../../src/record/json-path' );

describe( 'objects are created from paths and their value is set correctly', function(){

	it( 'sets simple values', function(){
		var record = {},
			jsonPath = new JsonPath( 'firstname' );

		jsonPath.setValue( record, 'Wolfram' );
		expect( record ).toEqual({ firstname: 'Wolfram' });
	});

	it( 'sets values for nested objects', function(){
		var record = {},
			jsonPath = new JsonPath( 'address.street' );
		jsonPath.setValue( record, 'someStreet' );

		expect( record ).toEqual({
			address: {
				street: 'someStreet'
			}
		});
	});

	it( 'sets values for arrays', function(){
		var record = {},
			jsonPath = new JsonPath( 'pastAddresses[1].street' );
		jsonPath.setValue( record, 'someStreet' );

		expect( JSON.stringify( record ) ).toEqual( JSON.stringify( {
			pastAddresses: [
			undefined,
			{
				street: 'someStreet'
			}]
		}));
	});

	it( 'extends existing objects', function(){
		var record = { firstname: 'Wolfram' },
			jsonPath = new JsonPath( 'lastname' );
		jsonPath.setValue( record, 'Hempel' );

		expect( record ).toEqual({
			firstname: 'Wolfram',
			lastname: 'Hempel'
		});
	});

	it( 'extends existing arrays', function(){
		var record = {
			firstname: 'Wolfram',
			animals: [ 'Bear', 'Cow', 'Ostrich' ]
		},
		jsonPath = new JsonPath( 'animals[ 1 ]' );
		jsonPath.setValue( record, 'Emu' );

		expect( record ).toEqual({
			firstname: 'Wolfram',
			animals: [ 'Bear', 'Emu', 'Ostrich' ]
		});
	});
});