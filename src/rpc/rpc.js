var C = require( '../constants/constants' ),
	RpcProxy = require( './rpc-proxy' );

/**
 * Relays a remote procedure call from a requestor to a provider and routes
 * the providers response to the requestor. Provider might either be a locally
 * connected SocketWrapper or a RpcProviderProxy that forwards messages
 * from a remote provider within the network
 *
 * @param {String|SocketWrapper} requestor SocketWrapper if requested locally, 
 *                                         C.SOURCE_MESSAGE_CONNECTOR if requested
 *                                         by the message connector
 * @param {SocketWrapper|RpcProviderProxy} provider  A SocketWrapper like class, able to provide the rpc
 * @param {Object} options
 * @param {Object} message
 *
 * @constructor
 */
var Rpc = function( requestor, provider, options, message ) {
	this._rpcName = message.data[ 0 ];
	this._correlationId = message.data[ 1 ];
	this._requestor = requestor;
	this._provider = provider;
	this._options = options;
	this._isAcknowledged = false;

	this._onProviderResponseFn = this._processProviderMessage.bind( this );

	this._ackTimeout = setTimeout( this._onAckTimeout.bind( this ), this._options.rpcAckTimeout );
	this._responseTimeout = setTimeout( this._onResponseTimeout.bind( this ), this._options.rpcTimeout );
	this._provider.on( C.TOPIC.RPC, this._onProviderResponseFn );
	this._provider.send( this._provider instanceof RpcProxy ? message : message.raw );
};

/**
 * Destroyes this Rpc, either because its completed
 * or because a timeout has occured
 *
 * @public
 * @returns {void}
 */
Rpc.prototype.destroy = function() {
	this._provider.removeListener( C.TOPIC.RPC, this._onProviderResponseFn );
	
	if( this._provider instanceof RpcProxy ) {
		this._provider.destroy();
	}

	if( this._requestor instanceof RpcProxy ) {
		this._requestor.destroy();
	}

	clearTimeout( this._ackTimeout );
	clearTimeout( this._responseTimeout );
};

/**
 * Callback for incoming messages from the RPC provider. The
 * RPC provider is expected to send two messages,
 *
 * RPC|A|<rpcName>|<correlationId>
 *
 * and
 *
 * RPC|RES|<rpcName>|<correlationId|[<data>]
 *
 * Both of these messages will just be forwarded directly
 * to the requestor
 *
 * @param   {Object} message parsed and validated provider message
 *
 * @private
 * @returns {void}
 */
Rpc.prototype._processProviderMessage = function( message ) {
	if( message.data[ 1 ] !== this._correlationId ) {
		return;
	}
	
	if( message.action === C.ACTIONS.ACK ) {
		this._handleAck( message );
	} 

	else if ( message.action === C.ACTIONS.RESPONSE ) {
		this._handleResponse( message );
	}
};

/**
 * Handles rpc acknowledgement messages from the provider.
 * If more than one Ack is received an error will be returned
 * to the provider
 *
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
Rpc.prototype._handleAck = function( message ) {
	if( this._isAcknowledged === true ) {
		this._provider.sendError( C.TOPIC.RPC, C.EVENT.MULTIPLE_ACK, [ this._rpcName, this._correlationId ] );
		return;
	}

	clearTimeout( this._ackTimeout );
	this._isAcknowledged = true;
	this._requestor.send( this._requestor instanceof RpcProxy ? message: message.raw );
};

/**
 * Forwards response messages from the provider. If the provider
 * sends more than one response subsequent messages will just
 * be ignored
 *
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
Rpc.prototype._handleResponse = function( message ) {
	clearTimeout( this._responseTimeout );
	this._requestor.send( this._requestor instanceof RpcProxy ? message: message.raw );
	this.destroy();
};

/**
 * Callback if the acknowledge message hasn't been returned
 * in time by the provider
 *
 * @private
 * @returns {void}
 */
Rpc.prototype._onAckTimeout = function() {
	this._requestor.sendError( C.TOPIC.RPC, C.EVENT.ACK_TIMEOUT, [ this._rpcName, this._correlationId ] );
	this.destroy();
};

/**
 * Callback if the response message hasn't been returned
 * in time by the provider
 *
 * @private
 * @returns {void}
 */
Rpc.prototype._onResponseTimeout = function() {
	this._requestor.sendError( C.TOPIC.RPC, C.EVENT.RESPONSE_TIMEOUT, [ this._rpcName, this._correlationId ] );
	this.destroy();
};

module.exports = Rpc;