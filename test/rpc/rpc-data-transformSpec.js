var C = require( '../../src/constants/constants' ),
	Rpc = require( '../../src/rpc/rpc' ),
	_msg = require( '../test-helper/test-helper' ).msg,
	SocketWrapper = require( '../../src/message/socket-wrapper' ),
	SocketMock = require( '../mocks/socket-mock' ),
	DataTransforms = require( '../../src/message/data-transforms' ),
	mockRpcHandler = { getAlternativeProvider: function(){ return []; } },
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
	responseMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.RESPONSE,
		raw: _msg( 'P|RES|addTwo|1234|N12+' ),
		data: [ 'addTwo', '1234', 'N12' ]
	},
	makeRpc = function( msg, dataTransforms ) {
		var provider = new SocketWrapper( new SocketMock(), {} ),
			requestor = new SocketWrapper( new SocketMock(), {} ),
			options = {
				rpcAckTimeout: 5,
				rpcTimeout: 5
			},
			localRpc;

		provider.user = 'provider-user-name';
		requestor.user = 'requestor-user-name';

		if( dataTransforms ) {
			options.dataTransforms = new DataTransforms( dataTransforms );
		}

		return {
			provider: provider,
			requestor: requestor,
			localRpc: new Rpc( mockRpcHandler, requestor, provider, options, msg )
		};
	};

describe( 'executes local rpc calls', function(){

	it( 'sends the original rpc request to the provider', function(){
		var provider = makeRpc( requestMessage ).provider;
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|O{"numA":5, "numB":7}+' ) );
	});

	it( 'calls the data transform function for an outgoing request', function(){
		var settings = [{
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			transform: function( data, metaData ) { return data; }
		}];

		spyOn( settings[ 0 ], 'transform' ).and.callThrough();
		var provider = makeRpc( requestMessage, settings ).provider;
		expect( settings[ 0 ].transform.calls.argsFor( 0 )[ 0 ] ).toEqual({ numA: 5, numB: 7 });
		expect( settings[ 0 ].transform.calls.argsFor( 0 )[ 1 ] ).toEqual({
			sender: 'requestor-user-name',
			receiver: 'provider-user-name',
			rpcName: 'addTwo' });
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|O{"numA":5,"numB":7}+' ) );
	});

	it( 'transforms the data for an outgoing request', function(){
		var settings = [{
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			transform: function( data, metaData ) {
				data.rpcName = metaData.rpcName;
				data.numA = data.numA * 3;
				return data;
			}
		}];

		var provider = makeRpc( requestMessage, settings ).provider;
		expect( provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|O{"numA":15,"numB":7,"rpcName":"addTwo"}+' ) );
	});

	it( 'leaves the response unchanged', function(){
		var settings = [{
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			transform: function( data, metaData ) {
				data.rpcName = metaData.rpcName;
				data.numA = 11;
				return data;
			}
		}];

		var rpc = makeRpc( requestMessage, settings );
		expect( rpc.provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|O{"numA":11,"numB":7,"rpcName":"addTwo"}+' ) );
		rpc.provider.emit( 'P', ackMessage );
		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|addTwo|1234|N12+' ) );
	});

	it( 'transforms both request and response', function(){
		var settings = [{
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.REQUEST,
			transform: function( data, metaData ) {
				data.rpcName = metaData.rpcName;
				data.numA = 11;
				return data;
			}
		},{
			topic: C.TOPIC.RPC,
			action: C.ACTIONS.RESPONSE,
			transform: function( data, metaData ) {
				data = data + 9;
				expect( metaData.sender ).toBe( 'provider-user-name' );
				expect( metaData.receiver ).toBe( 'requestor-user-name' );
				return data;
			}
		}];

		var rpc = makeRpc( requestMessage, settings );
		expect( rpc.provider.socket.lastSendMessage ).toBe( _msg( 'P|REQ|addTwo|1234|O{"numA":11,"numB":7,"rpcName":"addTwo"}+' ) );
		rpc.provider.emit( 'P', ackMessage );
		rpc.provider.emit( 'P', responseMessage );
		expect( rpc.requestor.socket.lastSendMessage ).toBe( _msg( 'P|RES|addTwo|1234|N21+' ) );
	});
});