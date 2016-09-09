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

describe( 'encounters errors while making an RPC', function(){
	var rpcHandler = new RpcHandler( options );
	var requestor = new SocketWrapper( new SocketMock(), {} );

	it( 'attempts an rpc with invalid message data', function(){
		rpcHandler.handle( requestor, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			raw: 'invalid-raw-message',
			data: [ 'addTwo' ]
		});

		expect( requestor.socket.lastSendMessage ).toBe( msg( 'P|E|INVALID_MESSAGE_DATA|invalid-raw-message+' ) );
	});

});