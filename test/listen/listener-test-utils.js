'use strict';

var ListenerRegistry = require( '../../src/listen/listener-registry' ),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' ),
	C = require( '../../src/constants/constants' );

var subscribedTopics,
	sendToSubscribersMock,
	providers,
	clients,
	listenerRegistry,
	options = { logger: new LoggerMock() },
	clientRegistry = null,
	messageHistory;

class ListenerTestUtils {
	constructor() {
		messageHistory = {};
		sendToSubscribersMock = jasmine.createSpy( 'sendToSubscribersMock' );

		subscribedTopics = [];
		clientRegistry = {
			getNames: function() {
				return subscribedTopics;
			},
			sendToSubscribers: sendToSubscribersMock
		};

		clients = [
			null, // to make tests start from 1
			new SocketWrapper( new SocketMock(), options ),
			new SocketWrapper( new SocketMock(), options )
		];
		clients[1].toString = function() { return 'c1' };
		clients[2].toString = function() { return 'c2' };

		providers = [
			null, // to make tests start from 1
			new SocketWrapper( new SocketMock(), options ),
			new SocketWrapper( new SocketMock(), options ),
			new SocketWrapper( new SocketMock(), options )
		];

		providers[1].toString = function() { return 'p1' };
		providers[2].toString = function() { return 'p2' };
		providers[3].toString = function() { return 'p3' };

		listenerRegistry = new ListenerRegistry( 'R', options, clientRegistry );
		expect( typeof listenerRegistry.handle ).toBe( 'function' );
	}

	/**
	* Provider Utils
	*/
	providerListensTo( provider, pattern ) {
		updateRegistry(providers[ provider ], C.ACTIONS.LISTEN, [ pattern ] )
		if( providers[ provider ].socket.getMsgSize() > 1 ) {
			verify(providers[ provider ], [C.ACTIONS.ACK, C.ACTIONS.LISTEN], pattern, 1 )
		} else {
			verify(providers[ provider ], [C.ACTIONS.ACK, C.ACTIONS.LISTEN], pattern)
		}
	}

	providerUnlistensTo( provider, pattern ) {
		updateRegistry(providers[ provider ], C.ACTIONS.UNLISTEN, [ pattern ] )
		verify(providers[ provider ], [C.ACTIONS.ACK, C.ACTIONS.UNLISTEN], pattern)
	}

	providerGetsSubscriptionFound( provider, pattern, subscription ) {
		verify( providers[ provider ], C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [pattern, subscription])
	}

	providerGetsSubscriptionRemoved( provider, pattern, subscription, negate ) {
		verify( providers[ provider ], C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [pattern, subscription] )
	}

	providerAcceptsButIsntAcknowledged( provider, pattern, subscriptionName, doesnthaveActiveProvider ) {
		this.providerAccepts( provider, pattern, subscriptionName, true )
	}

	providerAccepts( provider, pattern, subscriptionName, doesnthaveActiveProvider ) {
		updateRegistry( providers[ provider ], C.ACTIONS.LISTEN_ACCEPT, [pattern, subscriptionName ] );
		expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( !doesnthaveActiveProvider );
	}

	providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed( provider, pattern, subscriptionName ) {
		this.providerRejects( provider, pattern, subscriptionName, true )
	}

	providerAcceptsAndIsSentSubscriptionRemoved( provider, pattern, subscriptionName ) {
		this.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed( provider, pattern, subscriptionName )
		this.providerGetsSubscriptionRemoved( provider, pattern, subscriptionName )
	}

	providerRejects( provider, pattern, subscriptionName, doNotCheckActiveProvider ) {
		updateRegistry( providers[ provider ], C.ACTIONS.LISTEN_REJECT, [pattern, subscriptionName ] );
		if( !doNotCheckActiveProvider) {
			expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( false );
		}
	}

	providerSubscribesTo( provider, subscriptionName ) {
		listenerRegistry.onSubscriptionMade( subscriptionName, providers[ provider ], undefined );
		subscribedTopics.push(subscriptionName)
	}

	providerRecievedNoNewMessages( provider ) {
		verify( providers[ provider ], null)
	}

	acceptMessageThrowsError( provider, pattern, subscriptionName, doesnthaveActiveProvider ) {
		updateRegistry( providers[ provider ], C.ACTIONS.LISTEN_ACCEPT, [pattern, subscriptionName ] );
		//TODO
		//verify( providers[ provider], C.ACTIONS.ERROR, [ C.EVENT.INVALID_MESSAGE, C.ACTIONS.LISTEN_ACCEPT, pattern, subscriptionName ] );
	}

	rejectMessageThrowsError( provider, pattern, subscriptionName, doNotCheckActiveProvider ) {
		updateRegistry( providers[ provider ], C.ACTIONS.LISTEN_REJECT, [pattern, subscriptionName ] );
		//TODO
		//verify( providers[ provider], C.ACTIONS.ERROR, [ C.EVENT.INVALID_MESSAGE, C.ACTIONS.LISTEN_REJECT, pattern, subscriptionName ] );
	}

	providerLosesItsConnection( provider ) {
		providers[ provider ].socket.emit( 'close' )
	}

	/**
	* Subscriber Utils
	*/
	subscriptionAlreadyMadeFor( subscriptionName ) {
		subscribedTopics.push( subscriptionName )
	}

	clientSubscribesTo( client, subscriptionName ) {
		listenerRegistry.onSubscriptionMade( subscriptionName, clients[ client ], undefined );
		subscribedTopics.push(subscriptionName)
	}

	clientUnsubscribesTo( client, subscriptionName, remainingSubscriptions ) {
		if(remainingSubscriptions == null) {
			remainingSubscriptions = 0
		}
		listenerRegistry.onSubscriptionRemoved( subscriptionName, clients[ client ], remainingSubscriptions );
	}

	clientRecievedNoNewMessages( client ) {
		verify( clients[ client ], null)
	}

	clientRecievesPublishedUpdate( client, subscription, state ) {
		verify( clients[ client ], C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, [subscription, state? C.TYPES.TRUE : C.TYPES.FALSE ] )
	}

	publishUpdateSentToSubscribers( subscription, state ) {
		var msgString = msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER}|${subscription}|${state ? C.TYPES.TRUE : C.TYPES.FALSE}+` )
		expect( sendToSubscribersMock.calls.mostRecent().args ).toEqual( [ subscription, msgString ] )
	}

	subscriptionHasActiveProvider( subscription, value ) {
		expect( listenerRegistry.hasActiveProvider( subscription ) ).toBe( value );
	}

}

module.exports = ListenerTestUtils;

function updateRegistry( socket, action, data ) {
	var message = {
		topic: C.TOPIC.RECORD,
		action: action,
		data: data,
		raw: msg( `${C.TOPIC.RECORD}|${action}|${data.join('|')}+` )
	};
	listenerRegistry.handle( socket, message );
}

function verify(provider, actions, data, messageIndex, negate ) {
	var messageIndex = messageIndex || 0;
	if( actions == null) {
		var lastMessage = provider.socket.getMsg( 0 );
		expect( lastMessage ).toBe( (messageHistory[provider] || {}).message );
		expect( provider.socket.getMsgSize()).toBe( (messageHistory[provider] || {}).size );
		return
	}
	if( !( actions instanceof Array ) ) {
		actions = [ actions ];
	}
	if( !( data instanceof Array ) ) {
		data = [ data ];
	}
	var message = provider.socket.getMsg( messageIndex );
	messageHistory[provider] = {
		message: message,
		size: provider.socket.getMsgSize()
	}
	var expectedMessage = msg( `${C.TOPIC.RECORD}|${actions.join('|')}|${data.join('|')}+` );
	if( negate ) {
		expect( message ).not.toBe( expectedMessage );
	} else {
		expect( message ).toBe( expectedMessage );
	}
};