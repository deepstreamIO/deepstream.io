var C = require( '../../src/constants/constants' ),
	Rpc = require( '../../src/rpc/rpc' ),
	msg = require( '../test-helper/test-helper' ).msg,
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	RpcProxy = require( '../../src/rpc/rpc-proxy' ),
	alternativeProvider = new SocketWrapper( new SocketMock(), {} );
	mockRpcHandler = { getAlternativeProvider: function(){ return alternativeProvider; } },
	mockMessageConnector = new ( require( '../mocks/message-connector-mock' ) )(),
	options = {
		rpcAckTimeout: 5,
		rpcTimeout: 5
	},
	requestMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.REQUEST,
		raw: msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ),
		data: [ 'addTwo', '1234', 'O{"numA":5, "numB":7}' ]
	},
	ackMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.ACK,
		raw: msg( 'P|A|addTwo|1234+' ),
		data: [ 'addTwo', '1234' ]
	},
	errorMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.ERROR,
		raw: msg( 'P|E|ErrorOccured|addTwo|1234+' ),
		data: [ 'ErrorOccured', 'addTwo', '1234' ]
	},
	responseMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.RESPONSE,
		raw: msg( 'P|RES|addTwo|1234|N12+' ),
		data: [ 'addTwo', '1234', 'N12' ]
	},
	makeRpc = function( msg ) {
		var provider = new SocketWrapper( new SocketMock(), {} ),
			requestor = new SocketWrapper( new SocketMock(), {} ),
			localRpc = new Rpc( mockRpcHandler, requestor, provider, options, msg );

		return {
			provider: provider,
			requestor: requestor,
			localRpc: localRpc
		};
	};

describe( 'executes local rpc calls', function(){

	it( 'sends the original rpc request to the provider', function(){
		var provider = makeRpc( requestMessage ).provider;
		expect( provider.socket.lastSendMessage ).toBe( msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ) );
	});

	it( 'times out if no ack is received in time', function( done ){
		var requestor = makeRpc( requestMessage ).requestor;

		setTimeout(function(){
			expect( requestor.socket.lastSendMessage ).toBe( msg( 'P|E|ACK_TIMEOUT|addTwo|1234+' ) );
			done();
		}, 7 );
	});

	it( 'forwards ack message', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|A|addTwo|1234+' ) );
	});

	it( 'times out if response is not received in time', function( done ){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|A|addTwo|1234+' ) );
		setTimeout(function(){
			expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|E|RESPONSE_TIMEOUT|addTwo|1234+' ) );
			done();
		}, 8);
	});

	it( 'forwards response message', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|A|addTwo|1234+' ) );
		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|RES|addTwo|1234|N12+' ) );
	});

	it( 'forwards error message', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', errorMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|E|ErrorOccured|addTwo|1234+' ) );
	});

	it( 'ignores ack message if it arrives after response', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|RES|addTwo|1234|N12+' ) );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|RES|addTwo|1234|N12+' ) );
	});

	it( 'sends error for multiple ack messages', function(){
		var rpc = makeRpc( requestMessage );

		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|A|addTwo|1234+' ) );
		expect( rpc.provider.socket.lastSendMessage ).toBe( msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ) );

		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|A|addTwo|1234+' ) );
		expect( rpc.provider.socket.lastSendMessage ).toBe( msg( 'P|E|MULTIPLE_ACK|addTwo|1234+' ) );
	});

	it( 'ignores multiple responses', function(){
		var rpc = makeRpc( requestMessage );

		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|A|addTwo|1234+' ) );

		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( msg( 'P|RES|addTwo|1234|N12+' ) );

		rpc.requestor.socket.lastSendMessage = null;

		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( null );
	});
});

describe( 'reroutes remote rpc calls', function(){
	var rpc;
	var provider;
	var requestor;

	it( 'creates a remote to local rpc', function(){
		var rpcProxyOptions = {
			messageConnector: mockMessageConnector,
			serverName: 'serverNameA'
		};

		provider = new SocketWrapper( new SocketMock(), {} );
		requestor = new RpcProxy( rpcProxyOptions, 'private/xyz', 'addTwo', '1234' );
		requestor.send = jasmine.createSpy( 'send' );
		requestor.sendError = jasmine.createSpy( 'sendError' );
		rpc = new Rpc( mockRpcHandler, requestor, provider, options, requestMessage );
		expect( requestor.send ).not.toHaveBeenCalled();
	});

	it( 'receives a unrelated message from the provider', function(){
		provider.emit( C.TOPIC.RPC, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			raw: msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ),
			data: [ 'not', 'related', 'O{"numA":5, "numB":7}' ]
		});
		expect( requestor.send ).not.toHaveBeenCalled();
	});

	it( 'receives a rejection message from the original provider', function(){
		spyOn( mockRpcHandler, 'getAlternativeProvider' ).and.callThrough();
		expect( alternativeProvider.socket.lastSendMessage ).toBe( null );

		provider.emit( C.TOPIC.RPC, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REJECTION,
			raw: msg( 'P|REJ|addTwo|1234|O{"numA":5, "numB":7}+' ),
			data: [ 'addTwo', '1234' ]
		});

		expect( alternativeProvider.socket.lastSendMessage ).toBe( msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ) );
		expect( mockRpcHandler.getAlternativeProvider ).toHaveBeenCalled();
		expect( requestor.send ).not.toHaveBeenCalled();
		expect( requestor.sendError ).not.toHaveBeenCalled();
	});

	it( 'rejects the message again and runs out of alternative providers', function(){
		mockRpcHandler.getAlternativeProvider = function(){ return null; };

		alternativeProvider.emit( C.TOPIC.RPC, {
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REJECTION,
			raw: msg( 'P|REJ|addTwo|1234|O{"numA":5, "numB":7}+' ),
			data: [ 'addTwo', '1234' ]
		});

		expect( requestor.send ).not.toHaveBeenCalled();
		expect( requestor.sendError ).toHaveBeenCalledWith(  'P', 'NO_RPC_PROVIDER', [ 'addTwo', '1234' ] );
	});
});