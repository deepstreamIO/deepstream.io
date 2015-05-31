var Deepstream = require( '../src/deepstream.io' );

describe( 'the main server class', function(){
	it( 'exposes the message parser\'s convertTyped method', function(){
		var server = new Deepstream();

		expect( server.convertTyped( 'N42' ) ).toBe( 42 );
	});

	it( 'exposes constants as a static', function(){
		expect( Deepstream.constants ).toBeDefined( );
	});

	describe( 'parses low level authData to simpler output', function() {

	var message;
	var parsedMessage;

		beforeEach(function() {
			message = {
				topic: 'R',
				action: 'CR',
				data : [ 'RecordName', 1, 'data' ]
			};

			parsedMessage = {
				isRecord: false,
				isEvent: false,
				isRPC: false,

				isCreate: false,
				isRead: false,
				isChange: false,
				isDelete: false,

				name: 'RecordName',
				path: undefined,
				data: 'data'
			};
		});

		it( 'parses RPC message correctly', function(){
			message.topic = 'P';
			message.action = '';

			parsedMessage.isRPC = true;

			expect(Deepstream.readMessage(message)).toEqual(parsedMessage);
		});

		it( 'parses Event message correctly', function(){
			message.topic = 'E';
			message.action = '';

			parsedMessage.isEvent = true;

			expect(Deepstream.readMessage(message)).toEqual(parsedMessage);
		});

		describe( 'when a record is recieved', function() {

			beforeEach(function() {
				parsedMessage.isRecord = true;
			});

			it( 'parses read/create message correctly', function(){
				message.action = 'CR';
				message.data = [ 'RecordName', 1, 'data' ];

				parsedMessage.isCreate = true;
				parsedMessage.isRead = true;

				expect(Deepstream.readMessage(message)).toEqual(parsedMessage);
			});

			it( 'parses patch message correctly', function(){
				message.action = 'P';
				message.data = [ 'RecordName', 1, 'path', 'data' ];

				parsedMessage.isChange = true;
				parsedMessage.path = 'path';
				parsedMessage.data = 'data';

				expect(Deepstream.readMessage(message)).toEqual(parsedMessage);
			});

			it( 'returns record gets changed via update', function(){
				message.action = 'U';
				message.data = [ 'RecordName', 1, 'data' ];

				parsedMessage.isChange = true;
				parsedMessage.data = 'data';

				expect(Deepstream.readMessage(message)).toEqual(parsedMessage);
			});

			it( 'returns record gets deleted', function(){
				message.action = 'D';
				parsedMessage.isDelete = true;

				expect(Deepstream.readMessage(message)).toEqual(parsedMessage);
			});
	});
	});
});
