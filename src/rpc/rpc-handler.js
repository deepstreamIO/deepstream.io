var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	LocalRpc = require( './local-rpc' ),
	RemoteRpc = require( './remote-rpc' );

var RpcHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RPC );
};

RpcHandler.prototype.handle = function( socketWrapper, message ) {
	if( message.action === C.ACTIONS.SUBSCRIBE ) {
		this._registerProvider( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._unregisterProvider( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.REQUEST ) {
		this._makeRpc( socketWrapper, message );
	}
	
	else if( message.action !== C.ACTIONS.RESPONSE ) {
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
		rpcData = message.data[ 1 ] || null,
		randomIndex;
		
	if( localProviders ) {
		randomIndex = Math.floor( Math.random() * localProviders.length );
		new LocalRpc( socketWrapper, localProviders[ randomIndex ], rpcName, rpcData );
	} else {
		new RemoteRpc( socketWrapper, rpcName, rpcData );
	}
};

RpcHandler.prototype._isValidMessage = function( socketWrapper, message ) {
	if( message.data && typeof message.data[ 0 ] === 'string' ) {
		return true;
	}
	
	socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
	return false;
};

module.exports = RpcHandler;