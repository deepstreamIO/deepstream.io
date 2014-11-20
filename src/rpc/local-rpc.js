var C = require( '../constants/constants' );

/**
 * Makes a remote procedure call to provider and returns
 * the result to requestor.
 *
 * @param {String|SocketWrapper} requestor SocketWrapper if requested locally, 
 *                                         C.SOURCE_MESSAGE_CONNECTOR if requested
 *                                         by the message connector
 * @param {SocketWrapper} provider  A local socket, able to provide the rpc
 * @param {Object} options
 * @param {Object} message
 */
var LocalRpc = function( requestor, provider, options, message ) {
	this.correlationId = message.data[ 1 ]; //TODO Check
	this._requestor = requestor;
	this._provider = provider;
	this._options = options;
	this._rpcName = message.data[ 0 ];
	this._onProviderResponseFn = this._processProviderMessage.bind( this );

	this._ackTimeout = setTimeout( this._onAckTimeout.bind( this ), this._options.rpcAckTimeout );
	this._responseTimeout = setTimeout( this._onResponseTimeout.bind( this ), this._options.rpcTimeout );
	this._provider.on( C.TOPIC.RPC, this._onProviderResponseFn );
	this._provider.send( message.raw );
};

LocalRpc.prototype.destroy = function() {
	this._provider.removeListener( C.TOPIC.RPC, this._onProviderResponseFn );
	clearTimeout( this._ackTimeout );
	clearTimeout( this._responseTimeout );
};

LocalRpc.prototype._processProviderMessage = function( message ) {
	if( message.data[ 1 ] !== this.correlationId ) {
		return;
	}
	
	if( message.action === C.ACTIONS.ACK ) {
		clearTimeout( this._ackTimeout );
		this._requestor.send( message.raw );
	}
	
	else if( message.action === C.ACTIONS.RESPONSE ) {
		clearTimeout( this._responseTimeout );
		this._requestor.send( message.raw );
		this.destroy();
	}
};

LocalRpc.prototype._onAckTimeout = function() {
	this._requestor.sendError( C.TOPIC.RPC, C.EVENT.ACK_TIMEOUT, [ this._rpcName, this.correlationId ] );
	this.destroy();
};

LocalRpc.prototype._onResponseTimeout = function() {
	this._requestor.sendError( C.TOPIC.RPC, C.EVENT.RESPONSE_TIMEOUT, [ this._rpcName, this.correlationId ] );
	this.destroy();
};

module.exports = LocalRpc;