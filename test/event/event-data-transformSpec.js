var EventHandler = require( '../../src/event/event-handler' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	DataTransforms = require( '../../src/message/data-transforms' ),
	C = require( '../../src/constants/constants' ),
	messageConnectorMock = new (require( '../mocks/message-connector-mock' ))(),
	_msg = require( '../test-helper/test-helper' ).msg,
	LoggerMock = require( '../mocks/logger-mock' ),
	createEventHandler = function( dataTransformSettigns ) {
		var result = { subscriber: [] },
			subscriber,
			i;

		result.eventHandler = new EventHandler({
			messageConnector: messageConnectorMock,
			dataTransforms: new DataTransforms( dataTransformSettigns ),
			logger: new LoggerMock()
		});

		for( i = 0; i < 3; i++ ) {
			subscriber = new SocketWrapper( new SocketMock() );
			subscriber.user = 'socket_' + i;
			result.eventHandler.handle( subscriber, { 
				topic: C.TOPIC.EVENT, 
				action: C.ACTIONS.SUBSCRIBE,
				raw: 'rawMessageString',
				data: [ 'someEvent' ]
			});
			result.subscriber.push( subscriber );
		}

		return result;
	};


describe( 'event handler data transforms', function(){

	it( 'distributes events directly if no transform is specified', function(){
		var obj = createEventHandler([]);
		
		obj.eventHandler.handle( obj.subscriber[ 0 ], { 
			topic: C.TOPIC.EVENT, 
			action: C.ACTIONS.EVENT,
			raw: 'rawMessageString',
			data: [ 'someEvent', 'O{"value":"A"}' ]
		});

		expect( obj.subscriber[ 0 ].socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
		expect( obj.subscriber[ 1 ].socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|O{"value":"A"}+' ) );
		expect( obj.subscriber[ 2 ].socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|O{"value":"A"}+' ) );
	});

	it( 'applies transforms', function(){
		var setting = {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			transform: function( data, metaData ) {
				data.extraValue = 'B';
				return data;
			}
		};

		spyOn( setting, 'transform' ).andCallThrough();

		var obj = createEventHandler([ setting ]);

		obj.eventHandler.handle( obj.subscriber[ 0 ], { 
			topic: C.TOPIC.EVENT, 
			action: C.ACTIONS.EVENT,
			raw: 'rawMessageString',
			data: [ 'someEvent', 'O{"value":"A"}' ]
		});

		expect( setting.transform.calls[ 0 ].args[ 0 ] ).toEqual({ value: 'A', extraValue: 'B' });
		expect( setting.transform.calls[ 0 ].args[ 1 ] ).toEqual({ sender : 'socket_0', receiver : 'socket_1', eventName : 'someEvent' });
		expect( setting.transform.calls[ 1 ].args[ 0 ] ).toEqual({ value: 'A', extraValue: 'B' });
		expect( setting.transform.calls[ 1 ].args[ 1 ] ).toEqual({ sender : 'socket_0', receiver : 'socket_2', eventName : 'someEvent' });
		expect( obj.subscriber[ 0 ].socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
		expect( obj.subscriber[ 1 ].socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|O{"value":"A","extraValue":"B"}+' ) );
		expect( obj.subscriber[ 2 ].socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|O{"value":"A","extraValue":"B"}+' ) );
	});
});