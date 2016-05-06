var EventHandler = require( '../../src/event/event-handler' ),
		SocketWrapper = require( '../../src/message/socket-wrapper' ),
		C = require( '../../src/constants/constants' ),
		_msg = require( '../test-helper/test-helper' ).msg,
		SocketMock = require( '../mocks/socket-mock' ),
		messageConnectorMock = new (require( '../mocks/message-connector-mock' ))(),
		LoggerMock = require( '../mocks/logger-mock' ),
		options = { messageConnector: messageConnectorMock, logger: new LoggerMock() },
		eventHandler = new EventHandler( options ),
		subscriptionsMessage = {
			 topic: C.TOPIC.EVENT,
			 action: C.ACTIONS.SUBSCRIBE,
			 raw: 'rawMessageString',
			 data: [ 'someEvent' ]
	 },
	 eventMessage = {
			 topic: C.TOPIC.EVENT,
			 action: C.ACTIONS.EVENT,
			 raw: 'rawMessageString',
			 data: [ 'someEvent' ]
	 };

describe( 'the eventHandler routes events correctly', function(){

	 it( 'sends an error for invalid subscription messages', function(){
			 var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			 invalidMessage = {
					 topic: C.TOPIC.EVENT,
					 action: C.ACTIONS.SUBSCRIBE,
					 raw: 'rawMessageString'
			 };

			 eventHandler.handle( socketWrapper, invalidMessage );
			 expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|E|INVALID_MESSAGE_DATA|rawMessageString+' ) );
	 });

	 it( 'sends an error for subscription messages without an event name', function(){
			 var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
				invalidMessage = {
					 topic: C.TOPIC.EVENT,
					 action: C.ACTIONS.SUBSCRIBE,
					 raw: 'rawMessageString',
					 data: []
			 };

			 eventHandler.handle( socketWrapper, invalidMessage );
			 expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|E|INVALID_MESSAGE_DATA|rawMessageString+' ) );
	 });

	 it( 'sends an error for subscription messages with an invalid action', function(){
			 var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
				invalidMessage = {
					 topic: C.TOPIC.EVENT,
					 action: 'giberrish',
					 raw: 'rawMessageString',
					 data: []
			 };

			 eventHandler.handle( socketWrapper, invalidMessage );
			 expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|E|UNKNOWN_ACTION|unknown action giberrish+' ) );
	 });

	 it( 'subscribes to events', function(){
			 var socketWrapper = new SocketWrapper( new SocketMock(), {} );
			 expect( socketWrapper.socket.lastSendMessage ).toBe( null );
			 eventHandler.handle( socketWrapper, subscriptionsMessage );
			 expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
	 });

	it( 'triggers events', function(){
			var socketA = new SocketWrapper( new SocketMock(), {} ),
				socketB = new SocketWrapper( new SocketMock(), {} );

		 eventHandler.handle( socketA, subscriptionsMessage );
		 eventHandler.handle( socketB, subscriptionsMessage );

		 expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
		 expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );

		 //Raise event from socketA - only socketB should be notified
		 eventHandler.handle( socketA, eventMessage );
		 expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
		 expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent+' ) );
		 expect( messageConnectorMock.lastPublishedTopic ).toBe( 'E' );
		 expect( messageConnectorMock.lastPublishedMessage ).toEqual( eventMessage );

		 //Raise event from socketB - socket A should be notified
		 eventHandler.handle( socketB, eventMessage );
		 expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent+' ) );
		 expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent+' ) );

		 //Add event data
		 eventMessage.data[ 1 ] = 'eventData';
		 eventHandler.handle( socketB, eventMessage );
		 expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|eventData+' ) );
		 expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent+' ) );
		 expect( messageConnectorMock.lastPublishedTopic ).toBe( 'E' );
		 expect( messageConnectorMock.lastPublishedMessage ).toEqual( eventMessage );

		 //Add another socket
		 var socketC = new SocketWrapper( new SocketMock(), {} );
		 eventHandler.handle( socketC, subscriptionsMessage );
		 expect( socketC.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );

		 // Raise an event for all sockets
		 eventHandler.handle( socketA, eventMessage );
		 expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|eventData+' ) );
		 expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|eventData+' ) );
		 expect( socketC.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|eventData+' ) );
	 });

	it( 'sends errors for invalid messages', function(){
		var socketA = new SocketWrapper( new SocketMock(), {} );

		eventHandler.handle( socketA, {
			topic: C.TOPIC.EVENT,
			action: C.ACTIONS.EVENT,
			raw: 'rawMessageString',
			data: []
		});

 		expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|E|INVALID_MESSAGE_DATA|rawMessageString+' ) );
	});

	 it( 'unsubscribes', function(){
				var socketA = new SocketWrapper( new SocketMock(), {} ),
					socketB = new SocketWrapper( new SocketMock(), {} ),
					socketC = new SocketWrapper( new SocketMock(), {} );

			eventHandler.handle( socketA, subscriptionsMessage );
			eventHandler.handle( socketB, subscriptionsMessage );
			eventHandler.handle( socketC, subscriptionsMessage );

			eventHandler.handle( socketA, eventMessage );
			expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
			expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|eventData+' ) );
			expect( socketC.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|eventData+' ) );

			subscriptionsMessage.action = C.ACTIONS.UNSUBSCRIBE;
			eventHandler.handle( socketB, subscriptionsMessage );

			expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
			expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|A|US|someEvent+' ) );
			expect( socketC.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|eventData+' ) );

			eventMessage.data[ 1 ] = 'otherData';
			eventHandler.handle( socketA, eventMessage );

			expect( socketA.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someEvent+' ) );
			expect( socketB.socket.lastSendMessage ).toBe( _msg( 'E|A|US|someEvent+' ) );
			expect( socketC.socket.lastSendMessage ).toBe( _msg( 'E|EVT|someEvent|otherData+' ) );

			expect( messageConnectorMock.lastPublishedTopic ).toBe( 'E' );
			expect( messageConnectorMock.lastPublishedMessage ).toEqual( eventMessage );
	 });
});

