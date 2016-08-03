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
	updateRegistry(action, [ pattern ], socketWrapper)
	providerGets(socketWrapper, [C.ACTIONS.ACK, action], pattern)
}

function subcribe( subscriptionName, useParentSubscriptionRegistry ) {
	if( useParentSubscriptionRegistry !== false ) {
		useParentSubscriptionRegistry = true;
	}
	listenerRegistry.onSubscriptionMade( subscriptionName );
	if( useParentSubscriptionRegistry ) {
		subscribedTopics.push(subscriptionName)
	}

}

function unsubscribe( subscriptionName ) {
	listenerRegistry.onSubscriptionRemoved( subscriptionName );
}

function updateRegistry( action, data, socket) {
	var message = {
		topic: C.TOPIC.RECORD,
		action: action,
		data: data
	};
	listenerRegistry.handle( socket, message );
}

function accept(pattern, subscriptionName, socketWrapper) {
	updateRegistry( C.ACTIONS.LISTEN_ACCEPT, [pattern, subscriptionName ], socketWrapper);
	expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( true );
}

function reject(pattern, subscriptionName, socketWrapper) {
	updateRegistry( C.ACTIONS.LISTEN_REJECT, [pattern, subscriptionName ], socketWrapper);
	expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( false );
}

var messageHistory = {}
function providerGets(provider, actions, pattern, subscriptionName) {
	var messageIndex = 0;
	var options = {};
	var lastArg = arguments[ arguments.length - 1];
	if (typeof lastArg === 'object' ) {
		options = lastArg || {};
	}
	if( actions == null) {
		var lastMessage = provider.socket.getMsg( 0 );
		expect( lastMessage ).toBe( (messageHistory[provider] || {}).message );
		expect( provider.socket.getMsgSize()).toBe( (messageHistory[provider] || {}).size );
		return
	}
	if( options.index != null ) {
		messageIndex = options.index;
	}
	if( !( actions instanceof Array ) ) {
		actions = [ actions ];
	}
	if( subscriptionName == null || typeof subscriptionName !== 'string' ) {
		subscriptionName = '';
	} else {
		subscriptionName = '|' + subscriptionName;
	}
	var message = provider.socket.getMsg( messageIndex );
	messageHistory[provider] = {
		message: message,
		size: provider.socket.getMsgSize()
	}
	expect( message ).toBe(
		msg( `${C.TOPIC.RECORD}|${actions.join('|')}|${pattern}${subscriptionName}+` )
	);
}

fdescribe( 'listener-registry-load-balancing', function() {
	beforeEach(function() {
		subscribedTopics = [];
		recordSubscriptionRegistryMock = {
			getNames: function() {
				return subscribedTopics;
			}
		};
		provider1 = new SocketWrapper( new SocketMock(), options );
		provider1.toString = function() { return 'provider1' }
		provider2 = new SocketWrapper( new SocketMock(), options );
		provider2.toString = function() { return 'provider2' }
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
		9.  a/1 should have no active provider
		10. recieving unknown accept/reject throws an error
		*/

		it( 'single provider accepts a subscription', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', provider1)
			// 2
			subcribe( 'a/1' )
			// 3
			providerGets(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/.*', 'a/1')

			// 4 TODO:
			accept( 'a/.*', 'a/1' , provider1);
			// 6
			unsubscribe( 'a/1' );
			// 7
			providerGets( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, 'a/.*', 'a/1' )
			// 8 TODO:

            // 9 TODO: fix implementaiton for this expectation
            expect( listenerRegistry.hasActiveProvider( 'a/1' ) ).toBe( false );

			// 10
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
			addListener( C.ACTIONS.LISTEN, 'a/.*', provider1)
			// 2
			subcribe( 'a/1' )
			// 3
			providerGets(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/.*', 'a/1')

			// 4
			reject( 'a/.*', 'a/1' , provider1);

			// 5
			unsubscribe( 'a/1' );
			// 6
			providerGets(provider1, null)
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
			subscribedTopics.push( 'b/1' )
			updateRegistry( C.ACTIONS.LISTEN, [ 'b/.*' ], provider1 )
			providerGets( provider1, [C.ACTIONS.ACK, C.ACTIONS.LISTEN], 'b/.*', {index: 1})

			// 2
			providerGets( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'b/.*', 'b/1', {index: 0})

			// 3
			reject( 'b/.*', 'b/1' , provider1);
			// 4
			unsubscribe( 'b/1' );
			// 5
			providerGets( provider1, null)
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
			// 0
			subscribedTopics.push('b/1')

			// 1
			updateRegistry(C.ACTIONS.LISTEN, [ 'b/.*' ], provider1)
	        providerGets(provider1, [C.ACTIONS.ACK, C.ACTIONS.LISTEN], 'b/.*', {index: 1})
			// 2
			providerGets(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'b/.*', 'b/1', {index: 0})

			// 3
			accept( 'b/.*', 'b/1' , provider1);

			// 4 TODO:

			// 5
			unsubscribe( 'b/1' );

			// 6
			providerGets(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, 'b/.*', 'b/1')

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
			addListener( C.ACTIONS.LISTEN, 'a/.*', provider1)
			// 2
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', provider2)
			// 3
			subcribe( 'a/1' )
			// 4
			providerGets(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/.*', 'a/1')
			providerGets(provider2, null)

			// 5
			reject( 'a/.*', 'a/1' , provider1);
			// 6
			providerGets( provider1, null )
			providerGets( provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/[0-9]', 'a/1' )

			// 7
			accept( 'a/[0-9]', 'a/1' , provider2);

			// 8 TODO

			// 9
			unsubscribe( 'a/1' );

			// 10
			providerGets(provider1, null)
			// 11
			providerGets(provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, 'a/[0-9]', 'a/1')

			// 12 TODO:
		});

		/*
		1.  provider 1 does listen a/.*
		2.  provider 2 does listen a/[0-9]
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 1 responds with ACCEPT
		*/
		it( 'first accepts, seconds does nothing', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', provider1)
			// 2
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', provider2)
			// 3
			subcribe( 'a/1' )
			// 4
			providerGets(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/.*', 'a/1')
			providerGets(provider2, null)

			// 5
			accept( 'a/.*', 'a/1' , provider1);
			// 6
			providerGets(provider1, null)
			providerGets(provider2, null)

			// 7 TODO

			// 9
			unsubscribe( 'a/1' );

			// 10
			providerGets(provider2, null)
			// 11
			providerGets( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, 'a/.*', 'a/1')

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

		it( 'first rejects, seconds - which start listening after first gets SP - accepts', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', provider1)
			// 2
			subcribe( 'a/1' )
			// 3
			providerGets( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/.*', 'a/1')

			// 4
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', provider2)

			// 5
			reject( 'a/.*', 'a/1' , provider1);

			// 6
			providerGets( provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/[0-9]', 'a/1')
			providerGets( provider1, null )

			// 7
			accept( 'a/[0-9]', 'a/1' , provider2);

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

		it( 'no messages after unlisten', function() {
			// 1
			addListener( C.ACTIONS.LISTEN, 'a/.*', provider1)
			// 2
			addListener( C.ACTIONS.LISTEN, 'a/[0-9]', provider2)
			// 3
			subcribe( 'a/1' )

			// 4
			providerGets( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, 'a/.*', 'a/1' )
			providerGets( provider2, null )

			// 5
			addListener( C.ACTIONS.UNLISTEN, 'a/[0-9]', provider2)

			// 6
			reject( 'a/.*', 'a/1' , provider1);

			// 7
			providerGets( provider1, null )
			providerGets( provider2, null )

		});

	});

});
