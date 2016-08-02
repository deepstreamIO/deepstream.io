/* global describe, expect, it, jasmine */
var ListenerRegistry = require( '../../src/utils/listener-registry' ),
	C = require('../../src/constants/constants'),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' );

var subscribedTopics;
var listenerRegistry,
	options = { logger: new LoggerMock() },
	recordSubscriptionRegistryMock = null;


function addListener(action, pattern, socketWrapper) {
	updateListenerRegistry(action, [ pattern ], socketWrapper)
	expect( socketWrapper.socket.lastSendMessage ).toBe(
		msg( `${C.TOPIC.RECORD}|${C.ACTIONS.ACK}|${action}|${pattern}+` )
	);
	socketWrapper.socket.lastSendMessage = null;
}

function subcribe( subscriptionName ) {
	listenerRegistry.onSubscriptionMade( subscriptionName );
}

function unsubscribe( subscriptionName ) {
	listenerRegistry.onSubscriptionRemoved( subscriptionName );
}

function updateListenerRegistry( action, data, socket) {
	var message = {
		topic: C.TOPIC.RECORD,
		action: action,
		data: data
	};
	listenerRegistry.handle( socket, message );
}

function accept(pattern, subscriptionName, socketWrapper) {
	updateListenerRegistry( C.ACTIONS.LISTEN_ACCEPT, [pattern, subscriptionName ], socketWrapper);
	expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( true );
}

function reject(pattern, subscriptionName, socketWrapper) {
	updateListenerRegistry( C.ACTIONS.LISTEN_REJECT, [pattern, subscriptionName ], socketWrapper);
	expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( false );
}

fdescribe( 'listener-registry-load-balancing', function() {
	beforeEach(function() {
		subscribedTopics = [ 'b/1' ];
		recordSubscriptionRegistryMock = {
			getNames: function() {
				return subscribedTopics;
			}
		};
		listeningSocket = new SocketWrapper( new SocketMock(), options );
		secondListenerSocket = new SocketWrapper( new SocketMock(), options );
		listenerRegistry = new ListenerRegistry( 'R', options, recordSubscriptionRegistryMock );
		expect( typeof listenerRegistry.addListener ).toBe( 'function' );
	});

	describe( 'with a single provider', function(){
		/*
		1.  provider does listen a/.*
		2.  clients request a/1
		3.  provider gets a SP
		4.  provider responds with ACCEPT
		5.  send publishing=true to the clients (new action: PUBLISHING) // TODO:
		6.  clients discards a/1
		7.  provider gets a SR
		8.  send publishing=false to the clients (new action: PUBLISHING // TODO:
		9.  recieving unknown accept/reject throws an error
		*/

		it( 'single provider accepts a subscription', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', listeningSocket)
			// 2
			subcribe( 'a/1' )
			// 3
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/.*|a/1+` )
			);
			// 4 TODO:
			accept( 'a/.*', 'a/1' , listeningSocket);
			// 6
			unsubscribe( 'a/1' );
			// 7
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED}|a/.*|a/1+` )
			);
			// 8 TODO:

            // TODO: fix implementaiton for this expectation
            expect( listenerRegistry.hasActiveProvider( 'a/1' ) ).toBe( false );

			// 9
		});

		/*
		1. provider does listen a/.*
		2. clients request a/1
		3. provider gets a SP
		4. provider responds with REJECT
		5. clients discards a/1
		6. provider should not get a SR
		*/

		it( 'single provider rejects a subscription', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', listeningSocket)
			// 2
			subcribe( 'a/1' )
			// 3
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/.*|a/1+` )
			);
			listeningSocket.socket.lastSendMessage = null;

			// 4
			reject( 'a/.*', 'a/1' , listeningSocket);

			// 5
			unsubscribe( 'a/1' );
			// 6
			expect( listeningSocket.socket.lastSendMessage ).toBeNull();
		});

		/*
		0. subscription already made for b/1 (recordSubscriptionRegistryMock)
		1. provider does listen a/.*
		2. provider gets a SP
		3. provider responds with REJECT
		4. clients discards a/1
		5. provider should not get a SR
		*/

		it( 'single provider rejects a subscription with a pattern for which subscriptions already exists', function() {
			// 1
			updateListenerRegistry(C.ACTIONS.LISTEN, [ 'b/.*' ], listeningSocket)
	        expect( listeningSocket.socket.getMsg( 1 ) ).toBe( msg( 'R|A|L|b/.*+' ) );

			// 2
			expect( listeningSocket.socket.getMsg( 0 ) ).toBe( msg( 'R|SP|b/.*|b/1+' ) );
			listeningSocket.socket.lastSendMessage = null;

			// 3
			reject( 'b/.*', 'b/1' , listeningSocket);
			// 4
			unsubscribe( 'b/1' );
			// 5
			expect( listeningSocket.socket.lastSendMessage ).toBeNull();
		});

		/*
		0. subscription already made for b/1 (recordSubscriptionRegistryMock)
		1. provider does listen b/.*
		2. provider gets a SP
		3. provider responds with ACCEPT
		4. send publishing=true to the clients // TODO
		5. clients discards b/1
		6. provider gets a SR
		7. send publishing=false to the clients // TODO
		*/

		it( 'single provider accepts a subscription with a pattern for which subscriptions already exists', function() {
			// 1
			updateListenerRegistry(C.ACTIONS.LISTEN, [ 'b/.*' ], listeningSocket)
	        expect( listeningSocket.socket.getMsg( 1 ) ).toBe( msg( 'R|A|L|b/.*+' ) );

			// 2
			expect( listeningSocket.socket.getMsg( 0 ) ).toBe( msg( 'R|SP|b/.*|b/1+' ) );
			listeningSocket.socket.lastSendMessage = null;

			// 3
			accept( 'b/.*', 'b/1' , listeningSocket);

			// 4 TODO:

			// 5
			unsubscribe( 'b/1' );

			// 6
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED}|b/.*|b/1+` )
			);

			// 7 TODO:
		});

	});

	describe( 'with multiple providers', function(){

		/*
		1.  provider 1 does listen a/.*
		2.  provider 2 does listen a/[0-9]
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 1 responds with REJECTS
		6.  provider 2 gets a SP
		7.  provider 2 responds with ACCEPT
		8.  send publishing=true to the clients (new action: PUBLISHING) // TODO:
		9.  clients discards a/1
		10. provider 1 should not get a SR
		11. provider 2 gets a SR
		12. send publishing=false to the clients (new action: PUBLISHING // TODO:
		*/

		it( 'first rejects, seconds accepts', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', listeningSocket)
			// 2
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', secondListenerSocket)
			// 3
			subcribe( 'a/1' )
			// 4
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/.*|a/1+` )
			);
			expect( secondListenerSocket.socket.lastSendMessage ).toBeNull();
			listeningSocket.socket.lastSendMessage = null;
			// 5
			reject( 'a/.*', 'a/1' , listeningSocket);
			// 6
			expect( listeningSocket.socket.lastSendMessage ).toBeNull();
			expect( secondListenerSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/[0-9]|a/1+` )
			);
			secondListenerSocket.socket.lastSendMessage = null;
			// 7
			accept( 'a/[0-9]', 'a/1' , secondListenerSocket);

			// 8 TODO

			// 9
			unsubscribe( 'a/1' );

			// 10
			expect( listeningSocket.socket.lastSendMessage ).toBeNull();

			// 11
			expect( secondListenerSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED}|a/[0-9]|a/1+` )
			);
			// 12 TODO:
		});


		it( 'first accepts, seconds does nothing', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', listeningSocket)
			// 2
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', secondListenerSocket)
			// 3
			subcribe( 'a/1' )
			// 4
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/.*|a/1+` )
			);
			expect( secondListenerSocket.socket.lastSendMessage ).toBeNull();
			listeningSocket.socket.lastSendMessage = null;
			// 5
			accept( 'a/.*', 'a/1' , listeningSocket);
			// 6
			expect( listeningSocket.socket.lastSendMessage ).toBeNull();
			expect( secondListenerSocket.socket.lastSendMessage ).toBeNull();

			// 7 TODO

			// 9
			unsubscribe( 'a/1' );

			// 10
			expect( secondListenerSocket.socket.lastSendMessage ).toBeNull();

			// 11
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED}|a/.*|a/1+` )
			);
		});

		/*
		1.  provider 1 does listen a/.*
		2.  clients request a/1
		3.  provider 1 gets a SP
		4.  provider 2 does listen a/[0-9]
		5.  provider 1 responds with REJECTS
		6.  provider 2 gets a SP
		7.  provider 2 responds with ACCEPT
		*/

		it( 'first accepts, seconds does nothing', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', listeningSocket)
			// 2
			subcribe( 'a/1' )
			subscribedTopics.push('a/1')
			// 3
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/.*|a/1+` )
			);
			listeningSocket.socket.lastSendMessage = null;

			// 4
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', secondListenerSocket)

			// 5
			reject( 'a/.*', 'a/1' , listeningSocket);

			// 6
			expect( secondListenerSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/[0-9]|a/1+` )
			);
			expect( listeningSocket.socket.lastSendMessage ).toBeNull();
			secondListenerSocket.socket.lastSendMessage = null;

			// 7
			//accept( 'a/[0-9]', 'a/1' , secondListenerSocket);

		});

		/*
		1.  provider 1 does listen a/.*
		2.  provider 2 does listen a/[0-9]
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 2 does an unlisten for a/[0-9]
		6.  provider 1 responds with REJECTS
		7.  provider 2 does not get anything
		*/

		it( 'first accepts, seconds does nothing', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', listeningSocket)
			// 2
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', secondListenerSocket)
			// 3
			subcribe( 'a/1' )

			// 4
			expect( listeningSocket.socket.lastSendMessage ).toBe(
				msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND}|a/.*|a/1+` )
			);
			expect( secondListenerSocket.socket.lastSendMessage ).toBeNull();
			listeningSocket.socket.lastSendMessage = null;

			// 5
			addListener( C.ACTIONS.UNLISTEN, 'a/[0-9]', secondListenerSocket)

			// 6
			reject( 'a/.*', 'a/1' , listeningSocket);

			// 7
			expect( listeningSocket.socket.lastSendMessage ).toBeNull();
			expect( secondListenerSocket.socket.lastSendMessage ).toBeNull();

		});

	});

});
