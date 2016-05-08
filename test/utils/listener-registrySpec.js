/* global describe, expect, it, jasmine */
var ListenerRegistry = require( '../../src/utils/listener-registry' ),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' );


describe( 'listener-registry', function(){
    var listenerRegistry,
        options = { logger: new LoggerMock() },
        recordSubscriptionRegistryMock = { getNames: function() { return [ 'car/Mercedes', 'car/Abarth' ]; } },
        listeningSocket = new SocketWrapper( new SocketMock(), options );

    it( 'creates the listener registry', function(){
        listenerRegistry = new ListenerRegistry( 'R', options, recordSubscriptionRegistryMock );
        expect( typeof listenerRegistry.addListener ).toBe( 'function' );
    });

    it( 'adds a listener', function() {
        var message = {
            topic: 'R',
            action: 'L',
            data: [ 'user\/[A-Za-z]*$' ]
        };

        listenerRegistry.addListener( listeningSocket, message );
        expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|A|L|user\/[A-Za-z]*$+' ) );
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

    it( 'requests a snapshot of the listeners', function() {
        var message = {
            topic: 'R',
            action: 'LSN',
            data: [ 'car\/[A-Za-z]*' ]
        };

        listenerRegistry.sendSnapshot( listeningSocket, message );
        expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|SF|car/[A-Za-z]*|["car/Mercedes","car/Abarth"]+'  ) );
    });

    it( 'removes the listener', function() {
        var message = {
              topic: 'R',
              action: 'UL',
              data: [ 'user\/[A-Za-z]*$' ]
        };
       listenerRegistry.removeListener( listeningSocket, message );
       expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|A|UL|user\/[A-Za-z]*$+' ) );
    });

    it( 'makes a third subscription that matches the now removed listener\'s pattern', function(){
       listenerRegistry.onSubscriptionMade( 'user/Yasser' );
       expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|A|UL|user\/[A-Za-z]*$+' ) );
    });

    it( 'adds a listener with a pattern for which subscriptions already exists', function() {
        var message = {
            topic: 'R',
            action: 'L',
            data: [ 'car\/[A-Za-z]*$' ]
        };

        listenerRegistry.addListener( listeningSocket, message );

        expect( listeningSocket.socket.getMsg( 2 ) ).toBe( msg( 'R|A|L|car\/[A-Za-z]*$+' ) );
        expect( listeningSocket.socket.getMsg( 1 ) ).toBe( msg( 'R|SP|car\/[A-Za-z]*$|car/Mercedes+' ) );
        expect( listeningSocket.socket.getMsg( 0 ) ).toBe( msg( 'R|SP|car\/[A-Za-z]*$|car/Abarth+' ) );
    });

    it( 'removes subscriptions for a record', function() {
        listenerRegistry.onSubscriptionRemoved( 'car/Abarth' );
        expect( listeningSocket.socket.lastSendMessage ).toBe( msg( 'R|SR|car\/[A-Za-z]*$|car/Abarth+' ) );
    });

    it( 'removes a socket on close', function() {
        expect( Object.keys( listenerRegistry._patterns ) ).toEqual( [ 'car/[A-Za-z]*$' ] );
        expect( listenerRegistry._subscriptionRegistry.getSubscribers( 'car/[A-Za-z]*$' ).length ).toBe( 1 );

        listeningSocket.socket.emit( 'close' );

        expect( Object.keys( listenerRegistry._patterns ) ).toEqual( [] );
        expect( listenerRegistry._subscriptionRegistry.getSubscribers( 'car/[A-Za-z]*$' ) ).toBe( null );
    });
});

describe( 'listener-registry errors', function(){
    var listenerRegistry,
        options = { logger: { log: jasmine.createSpy( 'log' ) } },
        recordSubscriptionRegistryMock = { getNames: function() { return [ 'car/Mercedes', 'car/Abarth' ]; } },
        listeningSocket = new SocketWrapper( new SocketMock(), options );

    it( 'creates the listener registry', function(){
        listenerRegistry = new ListenerRegistry( 'R', options, recordSubscriptionRegistryMock );
        expect( typeof listenerRegistry.addListener ).toBe( 'function' );
    });

    it( 'adds a listener without message data', function(){
        var socketWrapper = new SocketWrapper( new SocketMock() );
        listenerRegistry.addListener( socketWrapper, {
            topic: 'R',
            action: 'L',
            data: []
        });
        expect( options.logger.log ).toHaveBeenCalledWith( 3, 'INVALID_MESSAGE_DATA', undefined );
        expect( socketWrapper.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|undefined+' ) );
    });

    it( 'adds a listener with invalid message data message data', function(){
        var socketWrapper = new SocketWrapper( new SocketMock() );
        listenerRegistry.addListener( socketWrapper, {
            topic: 'R',
            action: 'L',
            data: [ 44 ]
        });
        expect( options.logger.log ).toHaveBeenCalledWith( 3, 'INVALID_MESSAGE_DATA', 44 );
        expect( socketWrapper.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|44+' ) );
    });

    it( 'adds a listener with an invalid regexp', function(){
        var socketWrapper = new SocketWrapper( new SocketMock() );
        listenerRegistry.addListener( socketWrapper, {
            topic: 'R',
            action: 'L',
            data: [ 'us(' ]
        });
        expect( options.logger.log ).toHaveBeenCalledWith( 3, 'INVALID_MESSAGE_DATA', 'SyntaxError: Invalid regular expression: /us(/: Unterminated group' );
        expect( socketWrapper.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|SyntaxError: Invalid regular expression: /us(/: Unterminated group+' ) );
    });

    it( 'requests a snapshot with an invalid regexp', function(){
        var socketWrapper = new SocketWrapper( new SocketMock() );
        listenerRegistry.sendSnapshot( socketWrapper, {
            topic: 'R',
            action: 'L',
            data: [ 'xs(' ]
        });
        expect( options.logger.log ).toHaveBeenCalledWith( 3, 'INVALID_MESSAGE_DATA', 'SyntaxError: Invalid regular expression: /xs(/: Unterminated group' );
        expect( socketWrapper.socket.lastSendMessage ).toBe( msg( 'R|E|INVALID_MESSAGE_DATA|SyntaxError: Invalid regular expression: /xs(/: Unterminated group+' ) );
    });

});