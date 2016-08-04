/* global describe, expect, it, jasmine */
var ListenerRegistry = require( '../../src/utils/listener-registry' ),
	C = require('../../src/constants/constants'),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	noopMessageConnector = require( '../../src/default-plugins/noop-message-connector' );

var subscribedTopics,
	sendToSubscribersMock,
	client1,
	client2;
var listenerRegistry,
	options = { logger: new LoggerMock() },
	clientRegistry = null;


function updateRegistryAndVerify(socketWrapper, action, pattern) {
	updateRegistry(socketWrapper, action, [ pattern ])
	verify(socketWrapper, [C.ACTIONS.ACK, action], pattern)
}

function subscribe( subscriptionName, socketWrapper, count) {
	listenerRegistry.onSubscriptionMade( subscriptionName, socketWrapper, undefined );
	subscribedTopics.push(subscriptionName)
}

function unsubscribe( subscriptionName, socketWrapper, count) {
	if(count == null) {
		count = 0
	}
	listenerRegistry.onSubscriptionRemoved( subscriptionName, socketWrapper, count );
}

function updateRegistry( socket, action, data ) {
	var message = {
		topic: C.TOPIC.RECORD,
		action: action,
		data: data
	};
	listenerRegistry.handle( socket, message );
}

function accept(socketWrapper, pattern, subscriptionName, doesnthaveActiveProvider) {
	updateRegistry( socketWrapper, C.ACTIONS.LISTEN_ACCEPT, [pattern, subscriptionName ] );
	expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( !doesnthaveActiveProvider );
}

function reject(socketWrapper, pattern, subscriptionName, doNotCheckActiveProvider) {
	updateRegistry( socketWrapper, C.ACTIONS.LISTEN_REJECT, [pattern, subscriptionName ] );
	if( !doNotCheckActiveProvider) {
		expect( listenerRegistry.hasActiveProvider( subscriptionName ) ).toBe( false );
	}
}

var messageHistory = {}
function verify(provider, actions, data) {
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
	if( !( data instanceof Array ) ) {
		data = [ data ];
	}
	var message = provider.socket.getMsg( messageIndex );
	messageHistory[provider] = {
		message: message,
		size: provider.socket.getMsgSize()
	}
	expect( message ).toBe(
		msg( `${C.TOPIC.RECORD}|${actions.join('|')}|${data.join('|')}+` )
	);
}

fdescribe( 'listener-registry-load-balancing', function() {
	beforeEach(function() {
		sendToSubscribersMock = jasmine.createSpy( 'sendToSubscribersMock' );
		subscribedTopics = [];
		clientRegistry = {
			getNames: function() {
				return subscribedTopics;
			},
			sendToSubscribers: sendToSubscribersMock
		};
		client1 = new SocketWrapper( new SocketMock(), options );
		client2 = new SocketWrapper( new SocketMock(), options );
		provider1 = new SocketWrapper( new SocketMock(), options );
		provider1.toString = function() { return 'provider1' }
		provider2 = new SocketWrapper( new SocketMock(), options );
		provider2.toString = function() { return 'provider2' }
		listenerRegistry = new ListenerRegistry( 'R', options, clientRegistry );
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

		it( 'accepts a subscription', function() {
			// 1
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			subscribe( 'a/1', client1 )
			// 3
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])

			// 4 TODO:
			accept( provider1, 'a/.*', 'a/1' );
			// 6
			unsubscribe( 'a/1' , client1 );
			// 7
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['a/.*', 'a/1'] )
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

		it( 'rejects a subscription', function() {
			// 1
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			subscribe( 'a/1', client1 )
			// 3
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])

			// 4
			reject( provider1, 'a/.*', 'a/1' );

			// 5
			unsubscribe( 'a/1' , client1 );
			// 6
			verify(provider1, null)
		});

		/*
		0. subscription already made for b/1 (clientRegistry)
		1. provider does listen a/.*
		2. provider gets a SP
		3. provider responds with REJECT
		4. clients discards a/1
		5. provider should not get a SR
		*/

		it( 'rejects a subscription with a pattern for which subscriptions already exists', function() {
			// 0
			subscribedTopics.push( 'b/1' )
			// 1
			updateRegistry( provider1, C.ACTIONS.LISTEN, [ 'b/.*' ] )
			verify( provider1, [C.ACTIONS.ACK, C.ACTIONS.LISTEN], 'b/.*', {index: 1})

			// 2
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['b/.*', 'b/1'], {index: 0})

			// 3
			reject( provider1, 'b/.*', 'b/1' );
			// 4
			unsubscribe( 'b/1' , client1 );
			// 5
			verify( provider1, null)
		});

		/*
		0. subscription already made for b/1 (clientRegistry)
		1. provider does listen b/.*
		2. provider gets a SP
		3. provider responds with ACCEPT
		4. send publishing=true to the clients // TODO
		5. clients discards b/1
		6. provider gets a SR
		7. send publishing=false to the clients // TODO
		*/

		it( 'accepts a subscription with a pattern for which subscriptions already exists', function() {
			// 0
			subscribedTopics.push('b/1')

			// 1
			updateRegistry( provider1, C.ACTIONS.LISTEN, [ 'b/.*' ] )
	        verify(provider1, [C.ACTIONS.ACK, C.ACTIONS.LISTEN], 'b/.*', {index: 1})
			// 2
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['b/.*', 'b/1'], {index: 0})

			// 3
			accept( provider1, 'b/.*', 'b/1' );

			// 4 TODO:

			// 5
			unsubscribe( 'b/1' , client1 );

			// 6
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['b/.*', 'b/1'])

			// 7 TODO:
		});


		/*
		1.  provider 1 does listen a/.*
		2.  client 1 requests a/1
		3.  provider 1 gets a SP
		4.  provider 1 responds with ACCEPT
		5.  clients gets has provider=true
		6.  2nd client requests a/1
		7.  provider doesnt get told anything
		8.  client 2 gets publishing=true
		*/

		it( 'accepts a subscription for 2 clients', function() {
			// 1
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			subscribe( 'a/1', client1 )
			// 3
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])

			// 4
			accept( provider1, 'a/.*', 'a/1' );

			// 5
			var msgString = msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER}|a/1|${C.TYPES.TRUE}+` )
			expect( sendToSubscribersMock ).toHaveBeenCalledWith('a/1', msgString)
			expect( sendToSubscribersMock.calls.count() ).toBe( 1 )

			// 6
			subscribe( 'a/1', client2 )

			// 7
			verify( provider1, null )

			// 8
			verify( client2, C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, ['a/1', C.TYPES.TRUE] )

			// 6
			//unsubscribe( 'a/1' , client1 );
			// 7
			//verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['a/.*', 'a/1'] )
			// 8 TODO:

            // 9 TODO: fix implementaiton for this expectation
            //expect( listenerRegistry.hasActiveProvider( 'a/1' ) ).toBe( false );

		});

		/*
		1.  provider 1 does listen a/.*
		2.  client 1 a/1
		3.  provider 1 gets a SP
		4.  provider 1 responds with ACCEPT
		5.  clients gets has provider=true
		6.  provider 1 requests a/1 ( count == 2 )
		7.  client 1 discards a/1 ( count === 1)
		8.  provider gets send Subscription removed because provider is the last subscriber
		*/

		it( 'accepts a subscription for 2 clients', function() {
			// 1
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			subscribe( 'a/1', client1 )
			// 3
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])

			// 4
			accept( provider1, 'a/.*', 'a/1' )

			// 5
			var msgString = msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER}|a/1|${C.TYPES.TRUE}+` )
			expect( sendToSubscribersMock ).toHaveBeenCalledWith('a/1', msgString)
			expect( sendToSubscribersMock.calls.count() ).toBe( 1 )

			// 6
			subscribe( 'a/1', provider1 )
			verify( provider1, C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, ['a/1', C.TYPES.TRUE] )

			// 7
			unsubscribe( 'a/1' , client1, 1 )

			// 7
			unsubscribe( 'a/1' , provider1, 1 )

			// 8
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['a/.*', 'a/1'] )

		});

		/*
		0. subscription already made for b/1 (clientRegistry)
		1. provider does listen b/.*
		2. provider gets a SP
		3. provider responds with ACCEPT
		4. send HP=true to the clients // TODO
        5. another subscription made for b/1 by client 2
        6. send HP=true to client 2
		*/

		it( 'accepts a subscription with a pattern for which subscriptions already exists and do another subscription afterwards', function() {
			// 0
			subscribedTopics.push('b/1')

			// 1
			updateRegistry( provider1, C.ACTIONS.LISTEN, [ 'b/.*' ] )
	        verify(provider1, [C.ACTIONS.ACK, C.ACTIONS.LISTEN], 'b/.*', {index: 1})
			// 2
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['b/.*', 'b/1'], {index: 0})

			// 3
			accept( provider1, 'b/.*', 'b/1' );

			var msgString = msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER}|b/1|${C.TYPES.TRUE}+` )
			expect( sendToSubscribersMock ).toHaveBeenCalledWith('b/1', msgString)
			expect( sendToSubscribersMock.calls.count() ).toBe( 1 )

			// 5
			subscribe( 'b/1', client2 )

			// 6
			verify( client2, C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, ['b/1', C.TYPES.TRUE] )

			// // 7
			// unsubscribe( 'b/1' , client1);

			// // 8
			// verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['b/.*', 'b/1'])

			// 9 TODO: SUBSCRIPTION_HAS_PROVIDER = false
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
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			updateRegistryAndVerify( provider2, C.ACTIONS.LISTEN, 'a/[0-9]' )
			// 3
			subscribe( 'a/1', client1 )
			// 4
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])
			verify(provider2, null)

			// 5
			reject( provider1, 'a/.*', 'a/1' );
			// 6
			verify( provider1, null )
			verify( provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/[0-9]', 'a/1'] )

			// 7
			accept( provider2, 'a/[0-9]', 'a/1' );

			// 8 TODO

			// 9
			unsubscribe( 'a/1' , client1 );

			// 10
			verify(provider1, null)
			// 11
			verify(provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['a/[0-9]', 'a/1'])

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
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			updateRegistryAndVerify( provider2, C.ACTIONS.LISTEN, 'a/[0-9]' )
			// 3
			subscribe( 'a/1', client1 )
			// 4
			verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])
			verify(provider2, null)

			// 5
			accept( provider1, 'a/.*', 'a/1' );
			// 6
			verify(provider1, null)
			verify(provider2, null)

			// 7 TODO

			// 9
			unsubscribe( 'a/1' , client1 );

			// 10
			verify(provider2, null)
			// 11
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['a/.*', 'a/1'])

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
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			subscribe( 'a/1', client1 )
			// 3
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])

			// 4
			updateRegistryAndVerify( provider2, C.ACTIONS.LISTEN, 'a/[0-9]' )

			// 5
			reject( provider1, 'a/.*', 'a/1' );

			// 6
			verify( provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/[0-9]', 'a/1'])
			verify( provider1, null )

			// 7
			accept( provider2, 'a/[0-9]', 'a/1' );

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
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			updateRegistryAndVerify( provider2, C.ACTIONS.LISTEN, 'a/[0-9]' )
			// 3
			subscribe( 'a/1', client1 )

			// 4
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'] )
			verify( provider2, null )

			// 5
			updateRegistryAndVerify( provider2, C.ACTIONS.UNLISTEN, 'a/[0-9]' )

			// 6
			reject( provider1, 'a/.*', 'a/1' );

			// 7
			verify( provider1, null )
			verify( provider2, null )

		});

		/*
		1.  provider does listen a/.*
		2.  provider2 does listen a/[0-9]
		2.  clients request a/1
		3.  provider gets a SP
		4.  provider responds with ACCEPT
		5.  send publishing=true to the clients (new action: PUBLISHING) // TODO:
		6.  provider disconnects (emit.close())
		7.  send publishing=false to the clients (new action: PUBLISHING // TODO:
		8.  provider2 gets a SP
		9.  provider2 responds with Accept
		10. sending publishing=true
		*/
		it( 'provider 1 accepts a subscription and disconnects then provider 2 gets a SP', function() {
			// TODO
			// 1
			// updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// // 2
			// subscribe( 'a/1', client1 )
			// // 3
			// verify(provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'])

			// // 4 TODO:
			// accept( provider1, 'a/.*', 'a/1' );
			// // 6
			// unsubscribe( 'a/1' , client1 );
			// // 7
			// verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['a/.*', 'a/1'] )
			// // 8 TODO:

   //          // 9 TODO: fix implementaiton for this expectation
   //          expect( listenerRegistry.hasActiveProvider( 'a/1' ) ).toBe( false );

			// 10
		});

        /**
        Publisher Timeouts
*/


		/*
		1.  provider 1 does listen a/.*
		2.  provider 2 does listen a/[0-9]
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 1 times out -> treat as REJECT
		6.  provider 2 gets a SP
		7.  provider 2 responds with ACCEPT
		8.  provider 1 does not get anything
		*/

		it( 'provider 1 times out, provider 2 accepts', function(done) {
			// 1
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			updateRegistryAndVerify( provider2, C.ACTIONS.LISTEN, 'a/[0-9]' )
			// 3
			subscribe( 'a/1', client1 )

			// 4
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'] )
			// console.log('a', messageHistory)

			// 5
			setTimeout(function() {
				// 7
				accept( provider2, 'a/[0-9]', 'a/1' )

				// 6
				verify( provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/[0-9]', 'a/1'] )

				// 8
				// console.log('b', messageHistory)
				verify( provider1, null )
				done()
			}, 25)
		});

		/*
		1.  provider 1 does listen a/.*
		2.  provider 2 does listen a/[0-9]
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 1 times out -> treat as REJECT
		6.  provider 2 gets a SP
		7.  provider 1 responds with ACCEPT
		8.  provider 2 responds with ACCEPT
        9.  provider 1 gets a SR
		*/

		it( 'provider 1 times out, but then it accepts but will be ignored because provider 2 accepts as well', function(done) {
			// 1
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			updateRegistryAndVerify( provider2, C.ACTIONS.LISTEN, 'a/[0-9]' )
			// 3
			subscribe( 'a/1', client1 )

			// 4
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'] )

			// 5
			setTimeout(function() {
				// 6
				verify( provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/[0-9]', 'a/1'] )

				// 7
				accept( provider1, 'a/.*', 'a/1', true ) // hold this provider

				// 8
				accept( provider2, 'a/[0-9]', 'a/1' ) // use this provider -> provide 1 should be droped

				// 9
				verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, ['a/.*', 'a/1'] )

				// 10
				verify( provider1, null )
				done()
			}, 25)
		});

		/*
		1.  provider 1 does listen a/.*
		2.  provider 2 does listen a/[0-9]
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 1 times out -> treat as REJECT
		6.  provider 2 gets a SP
		7.  provider 1 responds with ACCEPT ( hold in pending and accept if next publisher rejects )
		7.  provider 2 responds with REJECT
		9.  client gets publish true
		*/

		it( 'provider 1 times out, but then it accept and will be used because provider 2 rejects', function(done) {
			// 1
			updateRegistryAndVerify( provider1, C.ACTIONS.LISTEN, 'a/.*' )
			// 2
			updateRegistryAndVerify( provider2, C.ACTIONS.LISTEN, 'a/[0-9]' )
			// 3
			subscribe( 'a/1', client1 )

			// 4
			verify( provider1, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/.*', 'a/1'] )

			// 5
			setTimeout(function() {
				// 6
				verify( provider2, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, ['a/[0-9]', 'a/1'] )

				// 7
				accept( provider1, 'a/.*', 'a/1', true) // in pending state

				// 10
				reject( provider2, 'a/[0-9]', 'a/1', true ) // should let provder 1 do the work

				// 9
				var msgString = msg( `${C.TOPIC.RECORD}|${C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER}|a/1|${C.TYPES.TRUE}+` )
				expect( sendToSubscribersMock ).toHaveBeenCalledWith('a/1', msgString)
				expect( sendToSubscribersMock.calls.count() ).toBe( 1 )

				done()
			}, 25)
		});

        // +++ Interval ( Not mandotory, can be null )

        /*
		1.  provider 1 does listen a/.*
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 1 rejects
		6.  some time passes...
		4.  provider 1 gets a SP
		...
		*/


        // Force relisten enquire

        /*
		1.  provider 1 does listen a/.*
		3.  clients request a/1
		4.  provider 1 gets a SP
		5.  provider 1 rejects
		6.  provider 1 does a listen to a/.* again without doing an unlisten=
		4.  provider 1 gets a SP for a/1
		...
		*/

	});

});
