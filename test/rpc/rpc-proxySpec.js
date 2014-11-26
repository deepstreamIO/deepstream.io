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
		expect( messageConnector.lastSubscribedTopic ).toBe( 'PRIVATE/serverNameA' );
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
});
