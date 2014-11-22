var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	LocalRpc = require( './local-rpc' ),
	RemoteRpc = require( './remote-rpc' );

/**
 * Handles incoming messages for the RPC Topic.
 *
 * @param {Object} options deepstream options
 */
var RpcHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RPC );
};

/**
 * Main interface. Handles incoming messages
 * from the message distributor
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and validated deepstream message
 *
 * @public
 * @returns {void}
 */
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
	
	/*
	 * Response and Ack messages from the provider are processed
	 * by the LocalRpc class directly
	 */
	else if( message.action !== C.ACTIONS.RESPONSE && message.action !== C.ACTIONS.ACK ) {
		socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
	}
};

/**
 * Callback for subscription messages. Registers
 * a client as a provider for specific remote
 * procedure calls as identified by <rpcName>
 * 
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
RpcHandler.prototype._registerProvider = function( socketWrapper, message ) {
	if( this._isValidMessage( 1, socketWrapper, message ) ) {
		this._subscriptionRegistry.subscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Callback for unsubscribe messages. Removes
 * a client as a provider for specific remote
 * procedure calls as identified by <rpcName>
 * 
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
RpcHandler.prototype._unregisterProvider = function( socketWrapper, message ) {
	if( this._isValidMessage( 1, socketWrapper, message ) ) {
		this._subscriptionRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Executes a RPC. If there are clients connected to
 * this deepstream instance that can provide the rpc, it
 * will be routed to a random one of them, otherwise it will be routed
 * to the message connector
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
RpcHandler.prototype._makeRpc = function( socketWrapper, message ) {
	
	if( !this._isValidMessage( 2, socketWrapper, message ) ) {
		return;
	}
	
	var rpcName = message.data[ 0 ],
		localProviders = this._subscriptionRegistry.getSocketWrappersForSubscription( rpcName ),
		randomLocalProvider;
		
	if( localProviders ) {
		randomLocalProvider = localProviders[ Math.floor( Math.random() * localProviders.length ) ];
		new LocalRpc( socketWrapper, randomLocalProvider, this._options, message );
	} else {
		new RemoteRpc( socketWrapper, this._options, message );
	}
};

/**
 * Checks if the incoming message is valid, e.g. if rpcName
 * is present for subscribe / unsubscribe messages or if
 * rpcName and correlationId is present for rpc calls.
 *
 * @param   {Number}  dataLength    The expected number of entries in the data array
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {Boolean} isValid
 */
RpcHandler.prototype._isValidMessage = function( dataLength, socketWrapper, message ) {
	if( message.data && message.data.length === dataLength && typeof message.data[ 0 ] === 'string' ) {
		return true;
	}
	
	socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
	return false;
};

module.exports = RpcHandler;