var EventHandler = require( '../../src/event/event-handler' ),
    SocketWrapper = require( '../../src/message/socket-wrapper' ),
    C = require( '../../src/constants/constants' ),
    SEP = C.MESSAGE_PART_SEPERATOR,
    SocketMock = require( '../mocks/socket-mock' ),
    messageConnectorMock = require( '../mocks/message-connector-mock' ),
    loggerMock = require( '../mocks/logger-mock' ),
    options = { messageConnector: messageConnectorMock, logger: loggerMock },
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
           var socketWrapper = new SocketWrapper( new SocketMock() ),
           invalidMessage = { 
               topic: C.TOPIC.EVENT, 
               action: C.ACTIONS.SUBSCRIBE,
               raw: 'rawMessageString'
           };
           
           eventHandler.handle( socketWrapper, invalidMessage );
           expect( socketWrapper.socket.lastSendMessage ).toBe( 'EVENT'+SEP+'E'+SEP+'INVALID_MESSAGE_DATA'+SEP+'rawMessageString' );
       });
       
       it( 'sends an error for subscription messages without an event name', function(){
           var socketWrapper = new SocketWrapper( new SocketMock() ),
            invalidMessage = { 
               topic: C.TOPIC.EVENT, 
               action: C.ACTIONS.SUBSCRIBE,
               raw: 'rawMessageString',
               data: []
           };
           
           eventHandler.handle( socketWrapper, invalidMessage );
           expect( socketWrapper.socket.lastSendMessage ).toBe( 'EVENT'+SEP+'E'+SEP+'INVALID_MESSAGE_DATA'+SEP+'rawMessageString' );
       });
       
       it( 'subscribes to events', function(){
           var socketWrapper = new SocketWrapper( new SocketMock() );
           expect( socketWrapper.socket.lastSendMessage ).toBe( null );
           eventHandler.handle( socketWrapper, subscriptionsMessage );
           expect( socketWrapper.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.ACK+SEP + C.ACTIONS.SUBSCRIBE + SEP +'someEvent' );
       });
       
        it( 'triggers events', function(){
            var socketA = new SocketWrapper( new SocketMock() ),
                socketB = new SocketWrapper( new SocketMock() );
                
           eventHandler.handle( socketA, subscriptionsMessage );
           eventHandler.handle( socketB, subscriptionsMessage );
           
           expect( socketA.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.ACK+SEP + C.ACTIONS.SUBSCRIBE + SEP +'someEvent' );
           expect( socketB.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.ACK+SEP + C.ACTIONS.SUBSCRIBE + SEP +'someEvent' );
           
           //Raise event from socketA - only socketB should be notified
           eventHandler.handle( socketA, eventMessage );
           expect( socketA.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.ACK+SEP + C.ACTIONS.SUBSCRIBE + SEP +'someEvent' );
           expect( socketB.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent' );
           
           //Raise event from socketB - socket A should be notified
           eventHandler.handle( socketB, eventMessage );
           expect( socketA.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent' );
           expect( socketB.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent' );
           
           //Add event data
           eventMessage.data[ 1 ] = 'eventData';
           eventHandler.handle( socketB, eventMessage );
           expect( socketA.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent'+ SEP + 'eventData' );
           expect( socketB.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent' );
           
           //Add another socket
           var socketC = new SocketWrapper( new SocketMock() );
           eventHandler.handle( socketC, subscriptionsMessage );
           expect( socketC.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.ACK+SEP + C.ACTIONS.SUBSCRIBE + SEP +'someEvent' );
           
           // Raise an event for all sockets
           eventHandler.handle( socketA, eventMessage );
           expect( socketA.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent'+ SEP + 'eventData' );
           expect( socketB.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent'+ SEP + 'eventData' );
           expect( socketC.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent'+ SEP + 'eventData' );
       });
       
       it( 'unsubscribes', function(){
            var socketA = new SocketWrapper( new SocketMock() ),
                socketB = new SocketWrapper( new SocketMock() ),
                socketC = new SocketWrapper( new SocketMock() );
                
            eventHandler.handle( socketA, subscriptionsMessage );
            eventHandler.handle( socketB, subscriptionsMessage );
            eventHandler.handle( socketC, subscriptionsMessage );
            
            eventHandler.handle( socketA, eventMessage );
            expect( socketA.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent'+ SEP + 'eventData' );
            expect( socketB.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent'+ SEP + 'eventData' );
            expect( socketC.socket.lastSendMessage ).toBe( 'EVENT'+SEP+C.ACTIONS.EVENT + SEP +'someEvent'+ SEP + 'eventData' );
       });
    });
    
    