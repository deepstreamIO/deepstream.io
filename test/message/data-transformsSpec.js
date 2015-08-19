
var C = require( '../../src/constants/constants' ),
	_msg = require( '../test-helper/test-helper' ).msg,
	DataTransforms = require( '../../src/message/data-transforms' ),
	initDataTransforms = function( settings ) {
		try{
			new DataTransforms( settings );
		} catch( e ) {
			return e.toString();
		}
		return null;
	};

describe( 'data-transforms', function(){

	var dataTransforms;
	
	it( 'errors when initialised with the wrong settings', function(){
		expect( initDataTransforms( 'a string' ) ).toBe( 'Error: option dataTransforms must be an array or null' );
		expect( initDataTransforms( [ 'a string' ] ) ).toBe( 'Error: transformation is not a map' );
		expect( initDataTransforms( [ {} ] ) ).toBe( 'Error: Transforms for topic undefined are not supported' );
		expect( initDataTransforms( [ { topic: C.TOPIC.AUTH } ] ) ).toBe( 'Error: Transforms for topic A are not supported' );
		expect( initDataTransforms( [ { topic: C.TOPIC.RECORD } ] ) ).toBe( 'Error: Transforms for action undefined are not supported for topic R' );
		expect( initDataTransforms( [ { topic: C.TOPIC.RECORD, action: C.ACTIONS.QUERY } ] ) ).toBe( 'Error: Transforms for action Q are not supported for topic R' );
		expect( initDataTransforms( [ { topic: C.TOPIC.RECORD, action: C.ACTIONS.READ } ] ) ).toBe( 'Error: setting.transform must be a function' );
		expect( initDataTransforms( [ { topic: C.TOPIC.RECORD, action: C.ACTIONS.READ, transform: 'bla' } ] ) ).toBe( 'Error: setting.transform must be a function' );
		expect( initDataTransforms( [ { topic: C.TOPIC.RECORD, action: C.ACTIONS.READ, transform: function(){} } ] ) ).toBe( null );
		expect( initDataTransforms( [ { topic: C.TOPIC.RECORD, action: C.ACTIONS.READ, transform: function(){} }, { topic: C.TOPIC.RECORD, action: C.ACTIONS.READ, transform: function(){} }] ) ).toBe( 'Error: transformation already registered for R R' );
	});

	it( 'initialises a dataTransforms object with two transform functions', function(){
		dataTransforms = new DataTransforms([{
			topic: C.TOPIC.RECORD,
			action: C.ACTIONS.READ,
			transform: function( data, metaData ) {
				data.title = data.amount * 2 + ' ' + metaData.username;
				return data;
			}
		},{
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.RESPONSE,
			transform: function( data, metaData ) {
				delete data.secretInformation;
				return data;
			}
		}]);
	});

	it( 'determines if a transformation is present', function(){
		expect( dataTransforms.has( C.TOPIC.RECORD, C.ACTIONS.UPDATE ) ).toBe( false );
		expect( dataTransforms.has( C.TOPIC.RECORD, C.ACTIONS.READ ) ).toBe( true );
		expect( dataTransforms.has( C.TOPIC.RPC, C.ACTIONS.REQUEST ) ).toBe( false );
		expect( dataTransforms.has( C.TOPIC.AUTH, C.ACTIONS.RESPONSE ) ).toBe( false );
		expect( dataTransforms.has( C.TOPIC.RPC, C.ACTIONS.RESPONSE ) ).toBe( true );
	});

	it( 'applies a transformation', function(){
		var data = dataTransforms.apply( 
			C.TOPIC.RECORD, 
			C.ACTIONS.READ,
			{ amount: 20 },
			{ username: 'Wolfram' }
		);
		expect( data ).toEqual({
			amount: 20,
			title: '40 Wolfram'
		});
	});

	it( 'applies another transformation', function(){
		var data = dataTransforms.apply( 
			C.TOPIC.RPC, 
			C.ACTIONS.RESPONSE,
			{ information: 'stuff', secretInformation: 'secretStuff' },
			{}
		);
		expect( data ).toEqual({ information: 'stuff' });
		expect( data.secretInformation ).not.toBeDefined();
	});
});