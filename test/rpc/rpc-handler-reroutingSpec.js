var RpcHandler = require( '../../src/rpc/rpc-handler' ),
	RpcProxy = require( '../../src/rpc/rpc-proxy' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	C = require( '../../src/constants/constants' ),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	MessageConnectorMock = require( '../mocks/message-connector-mock' );

var options = {
	messageConnector: new MessageConnectorMock(),
	logger: { log: jasmine.createSpy( 'log' ) },
	serverName: 'thisServer',
	rpcAckTimeout: 5,
	rpcTimeout: 5
};

describe('rpc handler returns alternative providers for the same rpc', function(){
	var rpcHandler;
	var rpcProxyForB;
	var providerForA1 = new SocketWrapper( new SocketMock(), {} );
	var providerForA2 = new SocketWrapper( new SocketMock(), {} );
	var providerForA3 = new SocketWrapper( new SocketMock(), {} );
	var providerForB1 = new SocketWrapper( new SocketMock(), {} );

	it( 'creates the rpc handler', function(){
		rpcHandler = new RpcHandler( options );
		expect( typeof rpcHandler.getAlternativeProvider ).toBe( 'function' );
	});

	it( 'registers providers', function(){
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

		expect( providerForA1.socket.lastSendMessage ).toBe( msg( 'P|A|S|rpcA+' ) );
		expect( providerForA2.socket.lastSendMessage ).toBe( msg( 'P|A|S|rpcA+' ) );
		expect( providerForA3.socket.lastSendMessage ).toBe( msg( 'P|A|S|rpcA+' ) );
		expect( providerForB1.socket.lastSendMessage ).toBe( msg( 'P|A|S|rpcB+' ) );
	});

	it( 'returns a local alternative provider for a', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcA', [], '1234' );
		expect( alternativeProvider ).toBe( providerForA1 );
		expect( alternativeProvider instanceof RpcProxy ).toBe( false );
	});

	it( 'returns a local alternative provider for a that is not A1', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcA', [ providerForA1 ], '1234' );
		expect( alternativeProvider ).toBe( providerForA2 );
		expect( alternativeProvider instanceof RpcProxy ).toBe( false );
	});

	it( 'returns a local alternative provider for b', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcB', [], '5678' );
		expect( alternativeProvider ).toBe( providerForB1 );
		expect( alternativeProvider instanceof RpcProxy ).toBe( false );
	});

	it( 'has run out of providers for b', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcB', [ providerForB1 ], '5678' );
		expect( alternativeProvider ).toBe( null );
	});

	it( 'returns a remoteRpcProxy as alternative provider for b', function(){
		rpcHandler._remoteProviderRegistry.getAllProviderTopics = function() { return [ 'private/xyz' ]; };
		rpcProxyForB = rpcHandler.getAlternativeProvider( 'rpcB', [ providerForB1 ], '5678' );
		expect( rpcProxyForB instanceof RpcProxy ).toBe( true );
	});

	it( 'has used up all local and remote providers for b', function(){
		var alternativeProvider = rpcHandler.getAlternativeProvider( 'rpcB', [ providerForB1, rpcProxyForB ], '5678' );
		expect( alternativeProvider ).toBe( null );
	});

	it( 'receives a provider query for an rpc without providers', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.QUERY,
			data: [ 'rpcX' ]
		});
		expect( options.messageConnector.lastPublishedMessage ).toEqual( null );
	});

	it( 'receives a provider query for an rpc with providers', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.QUERY,
			data: [ 'rpcA' ]
		});

		expect( options.messageConnector.lastPublishedMessage ).toEqual({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.PROVIDER_UPDATE,
			data: [{
				numberOfProviders: 3,
				privateTopic: 'PRIVATE/thisServer',
				rpcName: 'rpcA'
			}]
		});
	});

	it( 'receives a remote request for a local rpc', function(){
		options.messageConnector.simulateIncomingMessage({
			topic: 'PRIVATE/thisServer',
			originalTopic: C.TOPIC.RPC,
			remotePrivateTopic: 'PRIVATE/otherServer',
			action: C.ACTIONS.REQUEST,
			raw: msg( 'P|REQ|rpcB|1234|O{"numA":5, "numB":7}+' ),
			data: [ 'rpcB', '1234', 'O{"numA":5, "numB":7}' ]
		});

		expect( providerForB1.socket.lastSendMessage ).toEqual( msg( 'P|REQ|rpcB|1234|O{"numA":5, "numB":7}+' ));
	});
});