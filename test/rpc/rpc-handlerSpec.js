var RpcHandler = require( '../../src/rpc/rpc-handler' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	C = require( '../../src/constants/constants' ),
	_msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	messageConnectorMock = require( '../mocks/message-connector-mock' ),
	loggerMock = require( '../mocks/logger-mock' ),
	options = { messageConnector: messageConnectorMock, logger: loggerMock },
	rpcHandler = new RpcHandler( options ),
	subscriptionMessage = { 
		topic: C.TOPIC.RPC, 
		action: C.ACTIONS.SUBSCRIBE,
		raw: 'rawMessageString',
		data: [ 'addTwo' ]
	},
	requestMessage = { 
		topic: C.TOPIC.RPC, 
		action: C.ACTIONS.REQUEST,
		raw: _msg( 'RPC|REQ|addTwo|1234|{"numA":5, "numB":7}' ),
		data: [ 'addTwo', '1234', '{"numA":5, "numB":7}' ]
	},
	ackMessage = { 
		topic: C.TOPIC.RPC, 
		action: C.ACTIONS.ACK,
		raw: _msg( 'RPC|A|addTwo|1234' ),
		data: [ 'addTwo', '1234' ]
	},
	responseMessage = { 
		topic: C.TOPIC.RPC, 
		action: C.ACTIONS.RESPONSE,
		raw: _msg( 'RPC|RES|addTwo|1234|12' ),
		data: [ 'addTwo', '1234', '12' ]
	},
	additionalResponseMessage = { 
		topic: C.TOPIC.RPC, 
		action: C.ACTIONS.RESPONSE,
		raw: _msg( 'RPC|RES|addTwo|1234|14' ),
		data: [ 'addTwo', '1234', '14' ]
	};

describe( 'the rpc handler routes remote procedure call related messages', function(){
	
	it( 'sends an error for subscription messages without data', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() ),
			invalidMessage = { 
				topic: C.TOPIC.RPC, 
				action: C.ACTIONS.SUBSCRIBE,
				raw: 'rawMessageString1'
			};

		rpcHandler.handle( socketWrapper, invalidMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'RPC|E|INVALID_MESSAGE_DATA|rawMessageString1' ) );
	});

	it( 'sends an error for invalid subscription messages ', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() ),
			invalidMessage = { 
				topic: C.TOPIC.RPC, 
				action: C.ACTIONS.SUBSCRIBE,
				raw: 'rawMessageString2',
				data: [ 1, 'a'] 
			};

		rpcHandler.handle( socketWrapper, invalidMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'RPC|E|INVALID_MESSAGE_DATA|rawMessageString2' ) );
	});

	it( 'sends an error for unknown actions', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() ),
			invalidMessage = { 
				topic: C.TOPIC.RPC, 
				action: 'giberrish',
				raw: 'rawMessageString2',
				data: [ 1, 'a'] 
			};

		rpcHandler.handle( socketWrapper, invalidMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'RPC|E|UNKNOWN_ACTION|unknown action giberrish' ) );
	});

	it( 'routes subscription messages', function(){
		var socketWrapper = new SocketWrapper( new SocketMock() );
		rpcHandler.handle( socketWrapper, subscriptionMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'RPC|A|S|addTwo' ) );

		subscriptionMessage.action = C.ACTIONS.UNSUBSCRIBE;
		rpcHandler.handle( socketWrapper, subscriptionMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'RPC|A|US|addTwo' ) );
	});

	it( 'executes local rpcs', function(){
		var requestor = new SocketWrapper( new SocketMock() ),
			provider = new SocketWrapper( new SocketMock() );

		// Register provider
		subscriptionMessage.action = C.ACTIONS.SUBSCRIBE;
		rpcHandler.handle( provider, subscriptionMessage );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'RPC|A|S|addTwo' ) );

		// Issue Rpc
		rpcHandler.handle( requestor, requestMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'RPC|REQ|addTwo|1234|{"numA":5, "numB":7}' ) );
		
		// Return Ack
		provider.emit( 'RPC', ackMessage );
		expect( requestor.socket.lastSendMessage ).toBe( _msg( 'RPC|A|addTwo|1234' ) );

		// Sends error for additional acks
		requestor.socket.lastSendMessage = null;
		provider.emit( 'RPC', ackMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'RPC|E|MULTIPLE_ACK|addTwo|1234' ) );

		// Return Response
		provider.emit( 'RPC', responseMessage );
		expect( requestor.socket.lastSendMessage ).toBe( _msg( 'RPC|RES|addTwo|1234|12' ) );

		// Ignores additional responses
		requestor.socket.lastSendMessage = null;
		provider.socket.lastSendMessage = null;
		provider.emit( 'RPC', additionalResponseMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( provider.socket.lastSendMessage ).toBe( null );
	});
});