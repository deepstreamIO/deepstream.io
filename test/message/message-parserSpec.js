var messageParser = require( '../../src/message/message-parser' );

describe( 'message parser processes raw messages correctly', function(){
	
	it( 'parses record messages correctly', function(){
		expect( messageParser.parse( 'record‡C‡user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record‡C‡user/someId',
			action: 'create',
			data: ['user/someId']
		}]);

		expect( messageParser.parse( 'record‡C‡user/someId‡{"firstname":"Wolfram"}' ) ).toEqual([{
			topic: 'record',
			raw: 'record‡C‡user/someId‡{"firstname":"Wolfram"}',
			action: 'create',
			data: [ 'user/someId', '{"firstname":"Wolfram"}' ]
		}]);

		expect( messageParser.parse( 'record‡R‡user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record‡R‡user/someId',
			action: 'read',
			data: [ 'user/someId' ]
		}]);

		expect( messageParser.parse( 'record‡U‡user/someId‡{"firstname":"Wolfram"}' ) ).toEqual([{
			topic: 'record',
			raw: 'record‡U‡user/someId‡{"firstname":"Wolfram"}',
			action: 'update',
			data: [ 'user/someId', '{"firstname":"Wolfram"}' ]
		}]);

		expect( messageParser.parse( 'record‡D‡user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record‡D‡user/someId',
			action: 'delete',
			data: [ 'user/someId' ]
		}]);

		expect( messageParser.parse( 'record‡US‡user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record‡US‡user/someId',
			action: 'unsubscribe',
			data: [ 'user/someId' ]
		}]);
	});

	it( 'parses subscription messages correctly', function(){
		expect( messageParser.parse( 'listen‡S‡user/someId' ) ).toEqual([{
			topic: 'listen',
			raw: 'listen‡S‡user/someId',
			action: 'subscribe',
			data: [ 'user/someId']
		}]);

		expect( messageParser.parse( 'listen‡US‡user/someId' ) ).toEqual([{
			topic: 'listen',
			raw: 'listen‡US‡user/someId',
			action: 'unsubscribe',
			data: [ 'user/someId']
		}]);
	});

	it( 'parses rpc messages correctly', function(){
		expect( messageParser.parse( 'rpc‡I‡addValues‡{"val1":1,"val2":2}' ) ).toEqual([{
			topic: 'rpc',
			raw: 'rpc‡I‡addValues‡{"val1":1,"val2":2}',
			action: 'invoke',
			data: [ 'addValues', '{"val1":1,"val2":2}' ]
		}]);

		expect( messageParser.parse( 'rpc‡P‡addValues' ) ).toEqual([{
			topic: 'rpc',
			raw: 'rpc‡P‡addValues',
			action: 'provide',
			data: [ 'addValues' ]
		}]);

		expect( messageParser.parse( 'rpc‡UP‡addValues' ) ).toEqual([{
			topic: 'rpc',
			raw: 'rpc‡UP‡addValues',
			action: 'unprovide',
			data: [ 'addValues' ]
		}]);
	});

	it( 'parses event messages correctly', function(){
		expect( messageParser.parse( 'event‡S‡someEvent' ) ).toEqual([{
			topic: 'event',
			raw: 'event‡S‡someEvent',
			action: 'subscribe',
			data: [ 'someEvent' ]
		}]);

		expect( messageParser.parse( 'event‡US‡someEvent' ) ).toEqual([{
			topic: 'event',
			raw: 'event‡US‡someEvent',
			action: 'unsubscribe',
			data: [ 'someEvent' ]
		}]);		
	});
});