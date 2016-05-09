var RpcHandler = require( '../../src/rpc/rpc-handler' ),
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	C = require( '../../src/constants/constants' ),
	_msg = require( '../test-helper/test-helper' ).msg,
	SocketMock = require( '../mocks/socket-mock' ),
	MessageConnectorMock = require( '../mocks/message-connector-mock' ),
	LoggerMock = require( '../mocks/logger-mock' ),
	options = {
		messageConnector: new MessageConnectorMock(),
		logger: new LoggerMock(),
		serverName: 'thisServer',
		rpcAckTimeout: 5,
		rpcTimeout: 5
	},
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
		raw: _msg( 'P|REQ|addTwo|1234|{"numA":5, "numB":7}+' ),
		data: [ 'addTwo', '1234', '{"numA":5, "numB":7}' ]
	},
	ackMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.ACK,
		raw: _msg( 'P|A|addTwo|1234+' ),
		data: [ 'addTwo', '1234' ]
	},
	errorMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.ERROR,
		raw: _msg( 'P|E|ErrorOccured|addTwo|1234+' ),
		data: [ 'ErrorOccured', 'addTwo', '1234' ]
	},
	responseMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.RESPONSE,
		raw: _msg( 'P|RES|addTwo|1234|12+' ),
		data: [ 'addTwo', '1234', '12' ]
	},
	additionalResponseMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.RESPONSE,
		raw: _msg( 'P|RES|addTwo|1234|14+' ),
		data: [ 'addTwo', '1234', '14' ]
	},
	remoteRequestMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.REQUEST,
		raw: _msg( 'P|REQ|substract|44|{"numA":8, "numB":3}+' ),
		data: [ 'substract', '4', '{"numA":8, "numB":3}' ]
	},
	privateRemoteRequestMessage = {
		topic: 'PRIVATE/remoteTopic',
		action: C.ACTIONS.REQUEST,
		originalTopic: C.TOPIC.RPC,
		remotePrivateTopic: C.TOPIC.PRIVATE + options.serverName,
		raw: _msg( 'P|REQ|substract|44|{"numA":8, "numB":3}+' ),
		data: [ 'substract', '4', '{"numA":8, "numB":3}' ]
	},
	providerQueryMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.QUERY,
		data: [ 'substract' ]
	},
	providerUpdateMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.PROVIDER_UPDATE,
		data:[{
			rpcName: 'substract',
			numberOfProviders: 2,
			privateTopic: 'PRIVATE/remoteTopic'
		}]
	},
	privateRemoteAckMessage = {
		topic: C.TOPIC.PRIVATE + options.serverName,
		action: C.ACTIONS.ACK,
		raw: _msg( 'P|A|substract|4+'),
		originalTopic: C.TOPIC.RPC,
		data: [ 'substract', '4' ]
	},
	privateRemoteResponseMessage = {
		topic: C.TOPIC.PRIVATE + options.serverName,
		action: C.ACTIONS.RESPONSE,
		raw: _msg( 'P|RES|substract|4|5+' ),
		originalTopic: C.TOPIC.RPC,
		data: [ 'substract', '4', '5' ]
	};

describe( 'the rpc handler routes remote procedure call related messages', function(){

	it( 'sends an error for subscription messages without data', function(){
		var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			invalidMessage = {
				topic: C.TOPIC.RPC,
				action: C.ACTIONS.SUBSCRIBE,
				raw: 'rawMessageString1'
			};

		rpcHandler.handle( socketWrapper, invalidMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'P|E|INVALID_MESSAGE_DATA|rawMessageString1+' ) );
	});

	it( 'sends an error for invalid subscription messages ', function(){
		var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			invalidMessage = {
				topic: C.TOPIC.RPC,
				action: C.ACTIONS.SUBSCRIBE,
				raw: 'rawMessageString2',
				data: [ 1, 'a']
			};

		rpcHandler.handle( socketWrapper, invalidMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'P|E|INVALID_MESSAGE_DATA|rawMessageString2+' ) );
	});

	it( 'sends an error for unknown actions', function(){
		var socketWrapper = new SocketWrapper( new SocketMock(), {} ),
			invalidMessage = {
				topic: C.TOPIC.RPC,
				action: 'giberrish',
				raw: 'rawMessageString2',
				data: [ 1, 'a']
			};

		rpcHandler.handle( socketWrapper, invalidMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'P|E|UNKNOWN_ACTION|unknown action giberrish+' ) );
	});

	it( 'routes subscription messages', function(){
		var socketWrapper = new SocketWrapper( new SocketMock(), {} );
		rpcHandler.handle( socketWrapper, subscriptionMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'P|A|S|addTwo+' ) );

		subscriptionMessage.action = C.ACTIONS.UNSUBSCRIBE;
		rpcHandler.handle( socketWrapper, subscriptionMessage );
		expect( socketWrapper.socket.lastSendMessage ).toBe( _msg( 'P|A|US|addTwo+' ) );
	});

	it( 'executes local rpcs', function(){
		var requestor = new SocketWrapper( new SocketMock(), {} ),
			provider = new SocketWrapper( new SocketMock(), {} );

		// Register provider
		subscriptionMessage.action = C.ACTIONS.SUBSCRIBE;
		rpcHandler.handle( provider, subscriptionMessage );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|A|S|addTwo+' ) );

		// Issue Rpc
		rpcHandler.handle( requestor, requestMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|{"numA":5, "numB":7}+' ) );
		expect( provider.listeners( 'P' ).length ).toBe( 1 );

		// Return Ack
		provider.emit( 'P', ackMessage );
		expect( requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|addTwo|1234+' ) );

		// Sends error for additional acks
		requestor.socket.lastSendMessage = null;
		provider.emit( 'P', ackMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|E|MULTIPLE_ACK|addTwo|1234+' ) );

		// Return Response
		provider.emit( 'P', responseMessage );
		expect( requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|addTwo|1234|12+' ) );

		// Unregister Subscriber
		subscriptionMessage.action = C.ACTIONS.UNSUBSCRIBE;
		rpcHandler.handle( provider, subscriptionMessage );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|A|US|addTwo+' ) );

		// Ignores additional responses
		requestor.socket.lastSendMessage = null;
		provider.socket.lastSendMessage = null;
		provider.emit( 'P', additionalResponseMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( provider.socket.lastSendMessage ).toBe( null );
		expect( provider.listeners( 'P' ).length ).toBe( 0 );
	});

	it( 'executes local rpcs - error scenario', function(){
		var requestor = new SocketWrapper( new SocketMock(), {} ),
			provider = new SocketWrapper( new SocketMock(), {} );

		// Register provider
		subscriptionMessage.action = C.ACTIONS.SUBSCRIBE;
		rpcHandler.handle( provider, subscriptionMessage );

		// Issue Rpc
		rpcHandler.handle( requestor, requestMessage );

		// Error Response
		requestor.socket.lastSendMessage = null;

		provider.emit( 'P', errorMessage );

		expect( requestor.socket.lastSendMessage ).toBe( _msg( 'P|E|ErrorOccured|addTwo|1234+' ) );

		// Ignores additional responses
		requestor.socket.lastSendMessage = null;
		provider.socket.lastSendMessage = null;
		provider.emit( 'P', errorMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( provider.socket.lastSendMessage ).toBe( null );
		expect( provider.listeners( 'P' ).length ).toBe( 0 );
	});

	it( 'supports multiple RPCs in quick succession', function(){
		var requestor = new SocketWrapper( new SocketMock(), {} ),
			provider = new SocketWrapper( new SocketMock(), {} );

		// Register provider
		subscriptionMessage.action = C.ACTIONS.SUBSCRIBE;
		rpcHandler.handle( provider, subscriptionMessage );
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|A|S|addTwo+' ) );

		expect(function(){
			for( var i = 0; i < 50; i++ ) {
				rpcHandler.handle( requestor, requestMessage );
			}
		}).not.toThrow();
	});
});

describe( 'rpc handler routes requests to remote providers', function(){
	var requestor;

	/*
	 * Running tests in a single it block now as there were numerous problems
	 * with Jasmine's sequence
	 */
	it( 'executes remote rpcs', function(){
		options.messageConnector.reset();

		requestor = new SocketWrapper( new SocketMock(), {} );
		expect( options.messageConnector.lastPublishedMessage ).toBe( null );

		// There are no local providers for the substract rpc
		rpcHandler.handle( requestor, remoteRequestMessage );
		expect( options.messageConnector.lastPublishedMessage ).toEqual( providerQueryMessage );
	//});

	//it( 'forwards rpc to remote providers', function(){
		expect( requestor.socket.lastSendMessage ).toBe( null );

		options.messageConnector.simulateIncomingMessage( providerUpdateMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
		expect( options.messageConnector.lastPublishedMessage ).toEqual( privateRemoteRequestMessage );
	//});

	//it( 'forwards ack from remote provider to requestor', function(){
		expect( requestor.socket.lastSendMessage ).toBe( null );

		options.messageConnector.simulateIncomingMessage( privateRemoteAckMessage );
		expect( requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|substract|4+') );
	//});

	//it( 'forwards response from remote provider to requestor', function(){
		options.messageConnector.simulateIncomingMessage( privateRemoteResponseMessage );
		expect( requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|substract|4|5+' ) );
	//});

	//it( 'ignores subsequent responses', function(){
		requestor.socket.lastSendMessage = null;
		options.messageConnector.simulateIncomingMessage( privateRemoteResponseMessage );
		expect( requestor.socket.lastSendMessage ).toBe( null );
	});
});

