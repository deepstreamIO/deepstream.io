/* global it, expect, describe, jasmine */
var SubscriptionRegistry = require( '../../src/utils/subscription-registry' ),
	SocketMock = require( '../mocks/socket-mock' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	lastLogEvent = null,
	socketWrapperOptions = {logger:{ log: function(){}}},
	_msg = require( '../test-helper/test-helper' ).msg,
	options = { logger: { log: function( level, event, message ){ lastLogEvent = event; } } },
	subscriptionRegistry = new SubscriptionRegistry( options, 'E' ),
	subscriptionListenerMock = {
		onSubscriptionMade: jasmine.createSpy( 'onSubscriptionMade' ),
		onSubscriptionRemoved: jasmine.createSpy( 'onSubscriptionRemoved' )
	};

	subscriptionRegistry.setSubscriptionListener( subscriptionListenerMock );

describe( 'subscription-registry manages subscriptions', function(){

	var socketWrapperA = new SocketWrapper( new SocketMock(), socketWrapperOptions ),
		socketWrapperB = new SocketWrapper( new SocketMock(), socketWrapperOptions );

	it( 'subscribes to names', function(){
		expect( socketWrapperA.socket.lastSendMessage ).toBe( null );

		subscriptionRegistry.subscribe( 'someName', socketWrapperA );
		expect( subscriptionListenerMock.onSubscriptionMade ).toHaveBeenCalledWith( 'someName', socketWrapperA );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'E|A|S|someName+' ) );
		subscriptionRegistry.sendToSubscribers( 'someName', _msg( 'someMessage+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'someMessage+' ) );
	});

	it( 'doesn\'t subscribe twice to the same name', function(){
		expect( lastLogEvent ).toBe( 'S' );
		subscriptionRegistry.subscribe( 'someName', socketWrapperA );
		expect( subscriptionListenerMock.onSubscriptionMade.calls.count() ).toBe( 1 );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'E|E|MULTIPLE_SUBSCRIPTIONS|someName+' ) );
		expect( lastLogEvent ).toBe( 'MULTIPLE_SUBSCRIPTIONS' );
	});

	it( 'returns the subscribed socket', function(){
		expect( subscriptionRegistry.getSubscribers( 'someName' ) ).toEqual([ socketWrapperA ]);
	});

	it( 'determines if it has subscriptions', function(){
		expect( subscriptionRegistry.hasSubscribers( 'someName' ) ).toBe( true );
		expect( subscriptionRegistry.hasSubscribers( 'someOtherName' ) ).toBe( false );
	});

	it( 'distributes messages to multiple subscribers', function(){
		subscriptionRegistry.subscribe( 'someName', socketWrapperB );
		subscriptionRegistry.sendToSubscribers( 'someName', _msg( 'msg2+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg2+' ) );
		expect( socketWrapperB.socket.lastSendMessage ).toBe( _msg( 'msg2+' ) );
	});

	it( 'returns a random subscribed socket', function(){
		expect( subscriptionRegistry.getSubscribers( 'someName' ) ).toEqual([ socketWrapperA, socketWrapperB ]);

		var returnedA = false,
			returnedB = false,
			randomSubscriber,
			i;

		for( i = 0; i < 100; i++ ) {
			randomSubscriber = subscriptionRegistry.getRandomSubscriber( 'someName' );
			if( randomSubscriber === socketWrapperA ) returnedA = true;
			if( randomSubscriber === socketWrapperB ) returnedB = true;
		}

		expect( returnedA ).toBe( true );
		expect( returnedB ).toBe( true );
	});

	it( 'doesn\'t send message to sender', function(){
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg2+' ) );
		expect( socketWrapperB.socket.lastSendMessage ).toBe( _msg( 'msg2+' ) );
		subscriptionRegistry.sendToSubscribers( 'someName', _msg( 'msg3+' ), socketWrapperA );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg2+' ) );
		expect( socketWrapperB.socket.lastSendMessage ).toBe( _msg( 'msg3+' ) );
	});

	it( 'unsubscribes', function(){
		subscriptionRegistry.sendToSubscribers( 'someName', _msg( 'msg4+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg4+' ) );
		expect( socketWrapperB.socket.lastSendMessage ).toBe( _msg( 'msg4+' ) );

		subscriptionRegistry.unsubscribe( 'someName', socketWrapperB );
		expect( socketWrapperB.socket.lastSendMessage ).toBe( _msg( 'E|A|US|someName+' ) );
		subscriptionRegistry.sendToSubscribers( 'someName', _msg( 'msg5+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg5+' ) );
		expect( socketWrapperB.socket.lastSendMessage ).toBe( _msg( 'E|A|US|someName+' ) );
	});

	it( 'handles unsubscribes for non existant topics', function(){
		subscriptionRegistry.unsubscribe( 'giberish', socketWrapperB );
		expect( socketWrapperB.socket.lastSendMessage ).toBe( _msg( 'E|E|NOT_SUBSCRIBED|giberish+') );
	});

	it( 'handles unsubscribes for non existant subscriptions', function(){
		var newSocketWrapper = new SocketWrapper( new SocketMock(), socketWrapperOptions );
		subscriptionRegistry.unsubscribe( 'someName', newSocketWrapper );
		expect( newSocketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|E|NOT_SUBSCRIBED|someName+' ) );
	});

	it( 'routes the events', function(){
		subscriptionRegistry.subscribe( 'someOtherName', socketWrapperA );
		subscriptionRegistry.sendToSubscribers( 'someOtherName', _msg( 'msg6+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg6+' ) );

		subscriptionRegistry.sendToSubscribers( 'someName', _msg( 'msg7+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg7+' ) );

		expect( subscriptionListenerMock.onSubscriptionRemoved ).not.toHaveBeenCalled();
		subscriptionRegistry.unsubscribe( 'someName', socketWrapperA );
		expect( subscriptionListenerMock.onSubscriptionRemoved ).toHaveBeenCalledWith( 'someName', socketWrapperA );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'E|A|US|someName+' ) );
		subscriptionRegistry.sendToSubscribers( 'someName', _msg( 'msg8+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'E|A|US|someName+' ) );

		subscriptionRegistry.sendToSubscribers( 'someOtherName', _msg( 'msg9+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msg9+' ) );
	});

	it( 'removes all subscriptions on socket.close', function(){
		subscriptionRegistry.subscribe( 'nameA', socketWrapperA );
		subscriptionRegistry.subscribe( 'nameB', socketWrapperA );

		subscriptionRegistry.sendToSubscribers( 'nameA', _msg( 'msgA+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msgA+' ) );

		subscriptionRegistry.sendToSubscribers( 'nameB', _msg( 'msgB+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msgB+' ) );

		socketWrapperA.socket.emit( 'close' );

		subscriptionRegistry.sendToSubscribers( 'nameA', _msg( 'msgC+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msgB+' ) );

		subscriptionRegistry.sendToSubscribers( 'nameB', _msg( 'msgD+' ) );
		expect( socketWrapperA.socket.lastSendMessage ).toBe( _msg( 'msgB+' ) );
	});
});

describe( 'subscription-registry allows custom actions to be set', function(){

	var subscriptionRegistry = new SubscriptionRegistry( options, 'E' );
	var socketWrapper = new SocketWrapper( new SocketMock(), socketWrapperOptions );

	it( 'overrides the default actions', function(){
		subscriptionRegistry.setAction( 'subscribe', 'make-aware' );
		subscriptionRegistry.setAction( 'unsubscribe', 'be-unaware' );
		subscriptionRegistry.setAction( 'multiple_subscriptions', 'too-aware' );
		subscriptionRegistry.setAction( 'not_subscribed', 'unaware' );
	});

	it( 'subscribes to names', function(){
		subscriptionRegistry.subscribe( 'someName', socketWrapper );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|A|make-aware|someName+' ) );
	});

	it( 'doesn\'t subscribe twice to the same name', function(){
		expect( lastLogEvent ).toBe( 'make-aware' );
		subscriptionRegistry.subscribe( 'someName', socketWrapper );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|E|too-aware|someName+' ) );
		expect( lastLogEvent ).toBe( 'too-aware' );
	});

	it( 'unsubscribes', function(){
		subscriptionRegistry.unsubscribe( 'someName', socketWrapper );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|A|be-unaware|someName+' ) );
	});

	it( 'handles unsubscribes for non existant subscriptions', function(){
		var newSocketWrapper = new SocketWrapper( new SocketMock(), socketWrapperOptions );
		subscriptionRegistry.unsubscribe( 'someName', newSocketWrapper );
		expect( newSocketWrapper.socket.lastSendMessage ).toBe( _msg( 'E|E|unaware|someName+' ) );
	});
});

describe( 'subscription-registry unbinds all events on unsubscribe', function(){

	var subscriptionRegistry = new SubscriptionRegistry( options, 'E' );
	var socketWrapper = new SocketWrapper( new SocketMock(), socketWrapperOptions );

	it( 'subscribes and unsubscribes 30 times', function(){
		for( var i = 0; i < 30; i++ ) {
			subscriptionRegistry.subscribe( 'repeated-test', socketWrapper );
			subscriptionRegistry.unsubscribe( 'repeated-test', socketWrapper );
		}
	});
});

describe( 'subscription-registry handles empty states', function(){
	var subscriptionRegistry = new SubscriptionRegistry( options, 'E' );

	it( 'returns null if no subscriber is registered', function(){
		expect( subscriptionRegistry.getRandomSubscriber() ).toBe( null );
	});
});