var RpcProxy = require( '../../src/rpc/rpc-proxy' ),
	C = require( '../../src/constants/constants' ),
	messageConnector = new ( require( '../mocks/message-connector-mock' ) )(),
	options = {
		messageConnector: messageConnector,
		serverName: 'serverNameA'
	};

describe( 'rpcProxy proxies calls from and to the remote receiver', function(){
	var rpcProxy;

	it( 'creates the proxy', function(){
		expect( messageConnector.lastSubscribedTopic ).toBe( null );
		rpcProxy = new RpcProxy( options, 'recPrivateTopicA', 'rpcA', 'corIdA' );
	});

	it( 'manipulates the message before sending', function(){
		rpcProxy.send({
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.ACK,
			data: [ 'a', 'b' ]
		});

		expect( messageConnector.lastPublishedMessage ).toEqual({
			topic: 'recPrivateTopicA',
			originalTopic: C.TOPIC.RPC,
			action: C.ACTIONS.ACK,
			data: [ 'a', 'b' ],
			remotePrivateTopic: 'PRIVATE/serverNameA'
		});
	});

	it( 'adds a isCompleted flag after sending the message', function(){
		var msg = {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.ACK,
			data: [ 'a', 'b' ]
		};

		rpcProxy.send( msg );
		expect( msg.isCompleted ).toBe( true );
	});

});
