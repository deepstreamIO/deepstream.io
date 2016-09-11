var RpcHandler = require( '../../src/rpc/rpc-handler' ),
	RpcProxy = require( '../../src/rpc/rpc-proxy' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	C = require( '../../src/constants/constants' ),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	MessageConnectorMock = require( '../mocks/message-connector-mock' ),
	clusterRegistryMock = new (require( '../mocks/cluster-registry-mock' ))();

var options = {
	clusterRegistry: clusterRegistryMock,
	messageConnector: new MessageConnectorMock(),
	logger: { log: jasmine.createSpy( 'log' ) },
	serverName: 'thisServer',
	rpcAckTimeout: 5,
	rpcTimeout: 5
};

describe('rpc handler returns alternative providers for the same rpc', function(){
	var rpcHandler, rpcProxyForB, providerForA1, providerForA2, providerForA3, providerForB1;

	beforeAll( function() {
		providerForA1 = new SocketWrapper( new SocketMock(), {} );
		providerForA2 = new SocketWrapper( new SocketMock(), {} );
		providerForA3 = new SocketWrapper( new SocketMock(), {} );
		providerForB1 = new SocketWrapper( new SocketMock(), {} );

		rpcHandler = new RpcHandler( options );
		expect( typeof rpcHandler.getAlternativeProvider ).toBe( 'function' );

		rpcHandler.handle( providerForA1, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.SUBSCRIBE,
			raw: 'rawMessageString',
			data: [ 'rpcA' ]
		});

		rpcHandler.handle( providerForA2, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.SUBSCRIBE,
			raw: 'rawMessageString',
			data: [ 'rpcA' ]
		});

		rpcHandler.handle( providerForA3, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.SUBSCRIBE,
			raw: 'rawMessageString',
			data: [ 'rpcA' ]
		});

		rpcHandler.handle( providerForB1, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.SUBSCRIBE,
			raw: 'rawMessageString',
			data: [ 'rpcB' ]
		});

		// This is terrible practice, but we don't have any means to access the object otherwise
		rpcHandler._subscriptionRegistry.getAllRemoteServers = function( name ) {
			if( name === 'rpcA' ) {
				return [ 'random-server-1', 'random-server-2' ];
			};
		}
	});

	it( 'acks are sent to all providers', function(){
		expect( providerForA1.socket.lastSendMessage ).toBe( msg( 'P|A|S|rpcA+' ) );
		expect( providerForA2.socket.lastSendMessage ).toBe( msg( 'P|A|S|rpcA+' ) );
		expect( providerForA3.socket.lastSendMessage ).toBe( msg( 'P|A|S|rpcA+' ) );
	})

	it( 'makes two a/b RPCs', function(){
		rpcHandler.handle( providerForA1, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			data: [ 'rpcA', '1234', 'U' ]
		} );
		rpcHandler.handle( providerForB1, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			data: [ 'rpcB', '5678', 'U' ]
		}  );
	})

	it( 'returns a local alternative provider for a', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcA', '1234' );
		expect( alternativeProvider ).not.toBeNull();
		expect( alternativeProvider instanceof RpcProxy ).toBe( false );
	});

	it( 'returns a local alternative provider for a that is not A1', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcA', '1234' );
		expect( alternativeProvider ).not.toBeNull();
		expect( alternativeProvider instanceof RpcProxy ).toBe( false );
	});

	it( 'returns a remote alternative provider', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcA', '1234' );
		expect( alternativeProvider ).not.toBeNull();
		expect( alternativeProvider instanceof RpcProxy ).toBe( true );
	});

	it( 'returns a remote alternative provider', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcA', '1234' );
		expect( alternativeProvider ).not.toBeNull();
		expect( alternativeProvider instanceof RpcProxy ).toBe( true );
	});

	it( 'returns null when it runs out of providers', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcA', '1234' );
		expect( alternativeProvider ).toBeNull();
	});

	it( 'receives a remote request for a local rpc', function(){
		providerForB1.socket.lastSendMessage = null;

		options.messageConnector.simulateIncomingMessage({
			topic: 'PRIVATE/thisServer',
			originalTopic: C.TOPIC.RPC,
			remotePrivateTopic: 'PRIVATE/otherServer',
			action: C.ACTIONS.REQUEST,
			data: [ 'rpcB', '1234', 'O{"numA":5, "numB":7}' ]
		});

		expect( providerForB1.socket.lastSendMessage ).toEqual( msg( 'P|REQ|rpcB|1234|O{"numA":5, "numB":7}+' ));
	});
});