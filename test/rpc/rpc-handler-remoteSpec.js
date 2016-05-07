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

	it( 'encounters an error when querying for remote rpc providers', function(){
		var requestMessage = {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			raw: msg( 'P|REQ|addTwo|1234|{"numA":5, "numB":7}+' ),
			data: [ 'addTwo', '1234', '{"numA":5, "numB":7}' ]
		};
		requestor.socket.lastSendMessage = null;
		rpcHandler._remoteProviderRegistry.getProviderTopic = function( rpcName, callback ) {
			callback( requestor, requestMessage, 'something went wrong' );
		};

		rpcHandler.handle( requestor, requestMessage );
		expect( requestor.socket.lastSendMessage ).toBe( msg( 'P|E|NO_RPC_PROVIDER|addTwo|1234+' ) );
		expect( options.logger.log ).toHaveBeenCalledWith( 2, 'NO_RPC_PROVIDER', 'addTwo' );
	});
});