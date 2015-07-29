var C = require( '../../src/constants/constants' ),
	Rpc = require( '../../src/rpc/rpc' ),
	_msg = require( '../test-helper/test-helper' ).msg,
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	mockRpcHandler = { getAlternativeProvider: function(){ return []; } },
	options = {
		rpcAckTimeout: 5,
		rpcTimeout: 5
	},
	requestMessage = { 
		topic: C.TOPIC.RPC, 
		action: C.ACTIONS.REQUEST,
		raw: _msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ),
		data: [ 'addTwo', '1234', 'O{"numA":5, "numB":7}' ]
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
		raw: _msg( 'P|RES|addTwo|1234|N12+' ),
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
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ) );
	});

	it( 'times out if no ack is received in time', function( done ){
		var requestor = makeRpc( requestMessage ).requestor;

		setTimeout(function(){
			expect( requestor.socket.lastSendMessage ).toBe( _msg( 'P|E|ACK_TIMEOUT|addTwo|1234+' ) );
			done();
		}, 7 );
	});

	it( 'forwards ack message', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|addTwo|1234+' ) );
	});

	it( 'times out if response is not received in time', function( done ){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|addTwo|1234+' ) );
		setTimeout(function(){
			expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|E|RESPONSE_TIMEOUT|addTwo|1234+' ) );
			done();
		}, 8);
	});

	it( 'forwards response message', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|addTwo|1234+' ) );
		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|addTwo|1234|N12+' ) );
	});

	it( 'forwards error message', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', errorMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|E|ErrorOccured|addTwo|1234+' ) );
	});

	it( 'ignores ack message if it arrives after response', function(){
		var rpc = makeRpc( requestMessage );
		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|addTwo|1234|N12+' ) );
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|addTwo|1234|N12+' ) );
	});

	it( 'sends error for multiple ack messages', function(){
		var rpc = makeRpc( requestMessage );
		
		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|addTwo|1234+' ) );
		expect( rpc.provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ) );

		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|addTwo|1234+' ) );
		expect( rpc.provider.socket.lastSendMessage ).toBe( _msg( 'P|E|MULTIPLE_ACK|addTwo|1234+' ) );
	});

	it( 'ignores multiple responses', function(){
		var rpc = makeRpc( requestMessage );

		rpc.provider.emit( 'P', ackMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|A|addTwo|1234+' ) );

		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|addTwo|1234|N12+' ) );

		rpc.requestor.socket.lastSendMessage = null;

		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( null );
	});
});