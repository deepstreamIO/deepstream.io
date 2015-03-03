/* global describe, expect, it, jasmine */
var ListenerRegistry = require( '../../src/record/listener-registry' ),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' );

describe( 'record listener-registry', function(){
    var listenerRegistry,
        options = { logger: new LoggerMock() },
        recordSubscriptionRegistryMock = { getNames: function() { return [ 'car/Mercedes', 'car/Abarth' ]; } },
        listeningSocket = new SocketWrapper( new SocketMock() );
    
    it( 'creates the listener registry', function(){
        listenerRegistry = new ListenerRegistry( options, recordSubscriptionRegistryMock );
        expect( typeof listenerRegistry.addListener ).toBe( 'function' );
    });
    
    it( 'adds a listener', function() {
        var message = {
            topic: 'R',
            action: 'L',
            data: [ 'Suser\/[A-Za-z]*$' ]
        };
        
        listenerRegistry.addListener( listeningSocket, message );
        expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|A|S|user\/[A-Za-z]*$+' ) );
    });
    
    it( 'makes a subscription that matches the listener\'s pattern', function(){
       listenerRegistry.onSubscriptionMade( 'user/Wolfram' );
       expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|SP|user\/[A-Za-z]*$|user/Wolfram+' ) );
    });
    
    it( 'makes a subscription that doesn\'t match the listener\'s pattern', function(){
       listenerRegistry.onSubscriptionMade( 'user/Egon22' );
       expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|SP|user\/[A-Za-z]*$|user/Wolfram+' ) );
    });
    
    it( 'makes a second subscription that matches the listener\'s pattern', function(){
       listenerRegistry.onSubscriptionMade( 'user/Arthur' );
       expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|SP|user\/[A-Za-z]*$|user/Arthur+' ) );
    });
    
    it( 'removes the listener', function() {
        var message = {
              topic: 'R',
              action: 'UL',
              data: [ 'Suser\/[A-Za-z]*$' ]
        };
       listenerRegistry.removeListener( listeningSocket, message );
       expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|A|US|user\/[A-Za-z]*$+' ) );
    });
    
    it( 'makes a third subscription that matches the now removed listener\'s pattern', function(){
       listenerRegistry.onSubscriptionMade( 'user/Yasser' );
       expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|A|US|user\/[A-Za-z]*$+' ) );
    });
    
    it( 'adds a listener with a pattern for which subscriptions already exist', function() {
        var message = {
            topic: 'R',
            action: 'L',
            data: [ 'Scar\/[A-Za-z]*$' ]
        };
        
        listenerRegistry.addListener( listeningSocket, message );
        
        var sendMessages = listeningSocket.socket.sendMessages;
        
        expect( listeningSocket.socket.getMsg( 2 ) ).toBe( msg( 'R|A|S|car\/[A-Za-z]*$+' ) );
        expect( listeningSocket.socket.getMsg( 1 ) ).toBe( msg( 'R|SP|car\/[A-Za-z]*$|car/Mercedes+' ) );
        expect( listeningSocket.socket.getMsg( 0 ) ).toBe( msg( 'R|SP|car\/[A-Za-z]*$|car/Abarth+' ) );
    });
});