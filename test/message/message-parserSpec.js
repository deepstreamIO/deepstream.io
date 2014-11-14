var messageParser = require( '../../src/message/message-parser' );

describe( 'message parser processes raw messages correctly', function(){
	
	var x = String.fromCharCode( 30 ), // ASCII Record Seperator 1E
		y = String.fromCharCode( 31 ); // ASCII Unit Separator 1F

	it( 'parses record messages correctly', function(){
		expect( messageParser.parse( 'record'+y+'C'+y+'user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record'+y+'C'+y+'user/someId',
			action: 'create',
			data: ['user/someId']
		}]);

		expect( messageParser.parse( 'record'+y+'C'+y+'user/someId'+y+'{"firstname":"Wolfram"}' ) ).toEqual([{
			topic: 'record',
			raw: 'record'+y+'C'+y+'user/someId'+y+'{"firstname":"Wolfram"}',
			action: 'create',
			data: [ 'user/someId', '{"firstname":"Wolfram"}' ]
		}]);

		expect( messageParser.parse( 'record'+y+'R'+y+'user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record'+y+'R'+y+'user/someId',
			action: 'read',
			data: [ 'user/someId' ]
		}]);

		expect( messageParser.parse( 'record'+y+'U'+y+'user/someId'+y+'{"firstname":"Wolfram"}' ) ).toEqual([{
			topic: 'record',
			raw: 'record'+y+'U'+y+'user/someId'+y+'{"firstname":"Wolfram"}',
			action: 'update',
			data: [ 'user/someId', '{"firstname":"Wolfram"}' ]
		}]);

		expect( messageParser.parse( 'record'+y+'D'+y+'user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record'+y+'D'+y+'user/someId',
			action: 'delete',
			data: [ 'user/someId' ]
		}]);

		expect( messageParser.parse( 'record'+y+'US'+y+'user/someId' ) ).toEqual([{
			topic: 'record',
			raw: 'record'+y+'US'+y+'user/someId',
			action: 'unsubscribe',
			data: [ 'user/someId' ]
		}]);
	});

	it( 'parses subscription messages correctly', function(){
		expect( messageParser.parse( 'listen'+y+'S'+y+'user/someId' ) ).toEqual([{
			topic: 'listen',
			raw: 'listen'+y+'S'+y+'user/someId',
			action: 'subscribe',
			data: [ 'user/someId']
		}]);

		expect( messageParser.parse( 'listen'+y+'US'+y+'user/someId' ) ).toEqual([{
			topic: 'listen',
			raw: 'listen'+y+'US'+y+'user/someId',
			action: 'unsubscribe',
			data: [ 'user/someId']
		}]);
	});

	it( 'parses rpc messages correctly', function(){
		expect( messageParser.parse( 'rpc'+y+'I'+y+'addValues'+y+'{"val1":1,"val2":2}' ) ).toEqual([{
			topic: 'rpc',
			raw: 'rpc'+y+'I'+y+'addValues'+y+'{"val1":1,"val2":2}',
			action: 'invoke',
			data: [ 'addValues', '{"val1":1,"val2":2}' ]
		}]);

		expect( messageParser.parse( 'rpc'+y+'P'+y+'addValues' ) ).toEqual([{
			topic: 'rpc',
			raw: 'rpc'+y+'P'+y+'addValues',
			action: 'provide',
			data: [ 'addValues' ]
		}]);

		expect( messageParser.parse( 'rpc'+y+'UP'+y+'addValues' ) ).toEqual([{
			topic: 'rpc',
			raw: 'rpc'+y+'UP'+y+'addValues',
			action: 'unprovide',
			data: [ 'addValues' ]
		}]);
	});

	it( 'parses event messages correctly', function(){
		expect( messageParser.parse( 'event'+y+'S'+y+'someEvent' ) ).toEqual([{
			topic: 'event',
			raw: 'event'+y+'S'+y+'someEvent',
			action: 'subscribe',
			data: [ 'someEvent' ]
		}]);

		expect( messageParser.parse( 'event'+y+'US'+y+'someEvent' ) ).toEqual([{
			topic: 'event',
			raw: 'event'+y+'US'+y+'someEvent',
			action: 'unsubscribe',
			data: [ 'someEvent' ]
		}]);		
	});

	it( 'parses message blocks correctly', function(){
		var blockMsg = 'record'+y+'C'+y+'user/someId'+y+'{"firstname":"Wolfram"}'+x+'rpc'+y+'P'+y+'addValues'+x+'event'+y+'S'+y+'someEvent';
		
		expect( messageParser.parse( blockMsg ) ).toEqual([{
			topic: 'record',
			raw: 'record'+y+'C'+y+'user/someId'+y+'{"firstname":"Wolfram"}',
			action: 'create',
			data: [ 'user/someId', '{"firstname":"Wolfram"}' ]
		},{
			topic: 'rpc',
			raw: 'rpc'+y+'P'+y+'addValues',
			action: 'provide',
			data: [ 'addValues' ]
		},{
			topic: 'event',
			raw: 'event'+y+'S'+y+'someEvent',
			action: 'subscribe',
			data: [ 'someEvent' ]
		}]);
	});

	it( 'handles broken messages gracefully', function(){
		expect( messageParser.parse( 'dfds' ) ).toEqual( [ null ] );
		expect( messageParser.parse( 'record'+y+'unkn' ) ).toEqual( [ null ] );
		expect( messageParser.parse( 'record'+y+'unkn'+y+'aaa' ) ).toEqual( [ null ] );
	});
});