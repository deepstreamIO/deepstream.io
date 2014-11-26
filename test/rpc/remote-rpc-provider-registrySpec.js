var RemoteRpcProviderRegistry = require( '../../src/rpc/remote-rpc-provider-registry' ),
	MessageConnectorMock = require( '../mocks/message-connector-mock' ),
	options = {
		messageConnector: new MessageConnectorMock(),
		rpcProviderQueryTimeout: 10,
		rpcProviderCacheTime: 10
	};

describe( 'keeps track of which remote deepstream instance can provide which rpc', function(){
	
	
	var registry;
	
	it( 'creates the registry', function(){
		expect( options.messageConnector.lastSubscribedTopic ).toBe( null );
		registry = new RemoteRpcProviderRegistry( options );
	});
	
	
});