var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	RemoteRpcProviderRegistry = require( './remote-rpc-provider-registry' ),
	Rpc = require( './rpc' );

/**
 * Handles incoming messages for the RPC Topic.
 *
 * @param {Object} options deepstream options
 */
var RpcHandler = function( options ) {
	this._options = options;
	this._privateTopic = C.TOPIC.PRIVATE + this._options.serverName;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RPC );
	this._remoteProviderRegistry = new RemoteRpcProviderRegistry( options );
	this._options.messageConnector.subscribe( C.TOPIC.RPC, this._onMessageConnectorMessage.bind( this ) );
	this._options.messageConnector.subscribe( this._privateTopic, this._onPrivateMessage.bind( this ) );
	this._supportedSubActions = [ 
		C.ACTIONS.RESPONSE, 
		C.ACTIONS.ACK, 
		C.ACTIONS.PROVIDER_UPDATE, 
		C.ACTIONS.QUERY 
	];
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
	 * Response, Query, Provider update and Ack messages from the provider are processed
	 * by the Rpc class directly
	 */
	else if( this._supportedSubActions.indexOf( message.action ) === -1 ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
		
		if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
			socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
		}
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
		makeRemoteRpcFn,
		provider;
		
	if( this._subscriptionRegistry.hasSubscribers( rpcName ) ) {
		provider = this._subscriptionRegistry.getRandomSubscriber( rpcName );
		new Rpc( socketWrapper, provider, this._options, message );
	} else {
		makeRemoteRpcFn = this._makeRemoteRpc.bind( this, socketWrapper, message );
		provider = this._remoteProviderRegistry.getProviderProxy( rpcName, makeRemoteRpcFn );
	}
};

RpcHandler.prototype._makeRemoteRpc = function( requestor, message, error, provider ) {

	if( error !== null ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.NO_RPC_PROVIDER, message.rpcName );

		if( requestor !== C.SOURCE_MESSAGE_CONNECTOR ) {
			requestor.sendError( C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, message.rpcName );
		}

		return;
	}

	//new Rpc( requestor, provider, this._options, message );
};

RpcHandler.prototype._onMessageConnectorMessage = function( msg ) {
	if( msg.action === C.ACTIONS.QUERY ) {
		this._respondToProviderQuery( msg );
	}
};

RpcHandler.prototype._onPrivateMessage = function( msg ) {
	// TODO
};

RpcHandler.prototype._respondToProviderQuery = function( msg ) {
    var rpcName = msg.data[ 0 ],
    	providers = this._subscriptionRegistry.getSubscribers( rpcName ),
    	queryResponse;
    
    if( !providers ) {
    	return;
    }

    queryResponse = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.PROVIDER_UPDATE,
		data:[{
			numberOfProviders: providers.length,
			privateTopic: C.TOPIC.PRIVATE + this._options.serverName,
			rpcName: rpcName
		}]
	};

    this._options.messageConnector.publish( C.TOPIC.RPC, queryResponse );
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
	if( message.data && message.data.length >= dataLength && typeof message.data[ 0 ] === 'string' ) {
		return true;
	}
	
	socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
	return false;
};

module.exports = RpcHandler;