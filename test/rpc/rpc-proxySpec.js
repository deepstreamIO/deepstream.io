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
	
	it( 'adds a isCompleted flag after sending the message', function(){
		var msg = {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.ACK,
			data: [ 'a', 'b' ]
		};
		
		rpcProxy.send( msg );
		expect( msg.isCompleted ).toBe( true );
	});
	
	it( 'only processes messages that were meant for it', function() {
		var cb = jasmine.createSpy( 'cb' );
	   rpcProxy.on( C.TOPIC.RPC, cb );
	   
	   messageConnector.simulateIncomingMessage({
	   		topic: 'PRIVATE/serverNameA',
	   		originalTopic: 'notRpc'
	   });
	   
	   expect( cb ).not.toHaveBeenCalled();
	   
	    messageConnector.simulateIncomingMessage({
	   		topic: 'PRIVATE/serverNameA',
	   		originalTopic: C.TOPIC.RPC,
	   		data: []
	   });
	   
	    expect( cb ).not.toHaveBeenCalled();
	    
	    messageConnector.simulateIncomingMessage({
	   		topic: 'PRIVATE/serverNameA',
	   		originalTopic: C.TOPIC.RPC,
	   		data: [ 'rpcA', 'c' ]
	   });
	   
	    expect( cb ).not.toHaveBeenCalled();
	    
	   messageConnector.simulateIncomingMessage({
	   		topic: 'PRIVATE/serverNameA',
	   		originalTopic: C.TOPIC.RPC,
	   		data: [ 'b', 'corIdA' ]
	   });
	   
	    expect( cb ).not.toHaveBeenCalled();
	    
	    messageConnector.simulateIncomingMessage({
	   		topic: 'PRIVATE/serverNameA',
	   		originalTopic: C.TOPIC.RPC,
	   		data: [ 'rpcA', 'corIdA' ]
	   });
	   
	    expect( cb ).toHaveBeenCalled();
	   
	});
	
	it( 'destroys the proxy', function() {
		
		var cb = jasmine.createSpy( 'aaa' );
		
		rpcProxy.on( C.TOPIC.RPC, cb );
		
		messageConnector.simulateIncomingMessage({
	   		topic: 'PRIVATE/serverNameA',
	   		originalTopic: C.TOPIC.RPC,
	   		data: [ 'rpcA', 'corIdA' ]
	   });
	   
	    expect( cb.calls.count() ).toBe( 1 );
	    
	    rpcProxy.destroy();
	    
	   messageConnector.simulateIncomingMessage({
	   		topic: 'PRIVATE/serverNameA',
	   		originalTopic: C.TOPIC.RPC,
	   		data: [ 'rpcA', 'corIdA' ]
	   });
	   
	   expect( cb.calls.count() ).toBe( 1 );
	});
});
