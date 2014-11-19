var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' );

/**
 * The RPC protocol is a bit trickier - due to the messaging behind
 * deepstream being anonymous pub-sub whereas a remote procedure call requires direct
 * communication between two parties.
 *
 * Every deepstream server has two internal topics:
 *
 * C.TOPIC.RPC_QUERY is used to send out rpc-query-requests,
 * asking which other nodes would be able to provide a specific RPC.
 * rpc-query-requests are structured like this
 *
 * {
 * 		topic: C.TOPIC.RPC_CTRL,
 * 		action: C.ACTIONS.QUERY,
 * 		data: [{
 * 			rpcName: <rpcName>
 * 		}]
 * }
 *
 * Every deepstream server that can provide this rpc replies with
 *
 * {
 * 		topic: TOPIC.RPC_CTRL,
 * 		action: C.ACTIONS.PROVIDER_UPDATE,
 * 		data:[{
 * 			rpcName: <rpcName>,
 * 			serverName: <serverName>
 * 			numberOfProviders: <numberOfProviders>
 * 		}]
 * }
 * 
 * this response is received by all connected nodes, not only by the one that issued it.
 * It will be cached for <options.rpcProviderCacheTime>, so that
 * deepstream doesn't have to ask about providers every time a RPC comes in. Deepstream will
 * then pick a random provider. The likelihood of a specific provider to be picked is
 * 
 * <number of providers for that node> / <total number of providers across all nodes>
 *
 * Every deepstream node also listens on a private rpc topic, composed as
 *
 * C.TOPIC.RPC + '_' + <server name>
 *
 * The issuing node will then send a message to the providing nodes private rpc topic that's
 * structured like this
 *
 * {
 * 		topic: C.TOPIC.RPC_<server name>
 * 		action: C.ACTIONS.RPC_INVOKE
 * 		data: [{
 * 			correlationId: <uid>
 * 			rpcName: <rpc name>
 * 			data: <data>
 * 		}]
 * }
 *
 * and expects an immediate ack respone
 *
 * {
 * 		topic: C.TOPIC.RPC_<server name>
 * 		action: C.ACTIONS.ACK
 * 		data: [{
 * 			correlationId: <uid>
 * 			rpcName: <rpc name>
 * 		}]
 * }
 *
 * and subsequently the following response once the request is completed
 *
 * {
 * 		topic: C.TOPIC.RPC_<server name>
 * 		action: C.ACTIONS.RESPONSE
 * 		data: [{
 * 			correlationId: <uid>
 * 			rpcName: <rpc name>
 * 			data: [<data>]
 * 		}]
 * }
 *
 * If the ack isn't received within <options.rpcAckTimeout> the rpc
 * is sent to another provider and the rpc call will be removed from the provider cache
 * to force a new RPC_QUERY for the next one. If no providers are left an error will
 * be send to the client
 *
 * If the ack is received, but the response is not returned within <options.rpcTimeout> an
 * error will be sent to the client.
 */
var RpcHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RPC );
};

RpcHandler.prototype.handle = function( socketWrapper, message ) {
	if( message.action === C.ACTIONS.PROVIDE ) {
		this._registerProvider( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UNPROVIDE ) {
		this._unregisterProvider( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.RPC ) {
		this._makeRpc( socketWrapper, message );
	}

	else {
		socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
	}
};

RpcHandler.prototype._registerProvider = function( socketWrapper, message ) {
	if( this._isValidMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.subscribe( message.data[ 0 ], socketWrapper );
	}
};

RpcHandler.prototype._unregisterProvider = function( socketWrapper, message ) {
	if( this._isValidMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
	}
};

RpcHandler.prototype._makeRpc = function( socketWrapper, message ) {
	if( !this._isValidMessage( socketWrapper, message ) ) {
		return;
	}
	
	var rpcName = message.data[ 0 ],
		localProviders = this._subscriptionRegistry.getSocketWrappersForSubscription( rpcName ),
		params = message.data[ 1 ] || null,
		randomIndex;
		
	if( localProviders ) {
		randomIndex = Math.floor( Math.random() * localProviders.length );
		this._makeLocalRpc( socketWrapper, localProviders[ randomIndex ], rpcName, params );
	} else {
		this._makeRemoteRpc( socketWrapper, rpcName, params );
	}
};

RpcHandler.prototype._makeLocalRpc = function( requestor, provider, rpcName, params ) {
	
};

RpcHandler.prototype._makeLocalRpc = function( requestor, rpcName, params ) {
	
};

RpcHandler.prototype._isValidMessage = function( socketWrapper, message ) {
	if( message.data && typeof message.data[ 0 ] === 'string' ) {
		return true;
	}
	
	socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
	return false;
};