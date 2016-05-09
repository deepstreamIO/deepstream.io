var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	messageBuilder = require( '../message/message-builder' ),

	/*
	 * Event constant that allows for usage of the SubscriptionRegistry
	 * for callee listeners
	 */
	CALLEE_UPDATE_EVENT = 'callee-update',

	/*
	 * Messages with these actions will just be validated and forwarded between
	 * the two call participants without triggering any server-side action
	 */
	FORWARD_ACTIONS = [
		C.ACTIONS.WEBRTC_OFFER,
		C.ACTIONS.WEBRTC_ANSWER,
		C.ACTIONS.WEBRTC_ICE_CANDIDATE
	],

	/*
	 * Messages with these actions will be validated and forwarded, but will also
	 * remove the initiator from the registry, thereby effectively ending the call
	 */
	FINAL_ACTIONS = [
		C.ACTIONS.WEBRTC_CALL_DECLINED,
		C.ACTIONS.WEBRTC_CALL_ENDED
	];

/**
 * Handler for Web Real Time Communication related messages.
 *
 * Handles the registration of callees and the routing for call-messages.
 *
 * Every call is a dialog between an initiator, identified by a temporary id and a callee,
 * identified by a calleeName. This class maintains a map of callInitiator to socket that
 * keeps a reference to the initiator for the duration of the call.
 *
 * @param {Object} options deepstream options
 * @constructor
 */
var WebRtcHandler = function( options ) {
	this._options = options;
	this._calleeRegistry = new SubscriptionRegistry( this._options, C.TOPIC.WEBRTC, this );
	this._calleeListenerRegistry = new SubscriptionRegistry( this._options, C.TOPIC.WEBRTC );
	this._callInitiatiorRegistry = new SubscriptionRegistry( this._options, C.TOPIC.WEBRTC );
};

/**
 * Routes incoming messages
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Object} message parsed and validated deepstream message
 *
 * @public
 * @returns {void}
 */
WebRtcHandler.prototype.handle = function( socketWrapper, message ) {
	if( message.action === C.ACTIONS.WEBRTC_REGISTER_CALLEE ) {
		this._registerCallee( socketWrapper, message );
	}
	else if( message.action === C.ACTIONS.WEBRTC_UNREGISTER_CALLEE ) {
		this._unregisterCallee( socketWrapper, message );
	}
	else if( message.action === C.ACTIONS.WEBRTC_IS_ALIVE ) {
		this._checkIsAlive( socketWrapper, message );
	}
	else if( FORWARD_ACTIONS.indexOf( message.action ) !== -1 ) {
		this._forwardMessage( socketWrapper, message);
	}
	else if( FINAL_ACTIONS.indexOf( message.action ) !== -1 ) {
		this._forwardMessage( socketWrapper, message );
		this._clearInitiator( socketWrapper, message );
	}
	else if( message.action === C.ACTIONS.WEBRTC_LISTEN_FOR_CALLEES ) {
		this._calleeListenerRegistry.subscribe( CALLEE_UPDATE_EVENT, socketWrapper );
		socketWrapper.sendMessage( C.TOPIC.WEBRTC, C.ACTIONS.WEBRTC_ALL_CALLEES, this._calleeRegistry.getNames() );
	}
	else if( message.action === C.ACTIONS.WEBRTC_UNLISTEN_FOR_CALLEES ) {
		this._calleeListenerRegistry.unsubscribe( CALLEE_UPDATE_EVENT, socketWrapper );
	}
	else {
		socketWrapper.sendError( C.TOPIC.WEBRTC, C.EVENT.UNKNOWN_ACTION, message.action );
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.raw );
	}
};

/**
 * Callback that will be invoked by the calleeRegistry whenever a callee is registered
 *
 * @param   {String} calleeName    The name of the newly registered callee
 * @param   {SocketWrapper} socketWrapper The socket that's associated with the callee
 *
 * @implements {SubscriptionListener}
 *
 * @public
 * @returns {void}
 */
WebRtcHandler.prototype.onSubscriptionMade = function( calleeName, socketWrapper ) {
	var message = messageBuilder.getMsg( C.TOPIC.WEBRTC, C.ACTIONS.WEBRTC_CALLEE_ADDED, [ calleeName ] );
	this._calleeListenerRegistry.sendToSubscribers( CALLEE_UPDATE_EVENT, message, socketWrapper );
};

/**
 * Callback that will be invoked by the calleeRegistry whenever a callee is deregistered
 *
 * @param   {String} calleeName    The name of the now deregistered callee
 * @param   {SocketWrapper} socketWrapper The socket that was associated with the callee
 *
 * @implements {SubscriptionListener}
 *
 * @public
 * @returns {void}
 */
WebRtcHandler.prototype.onSubscriptionRemoved = function( calleeName, socketWrapper ) {
	var message = messageBuilder.getMsg( C.TOPIC.WEBRTC, C.ACTIONS.WEBRTC_CALLEE_REMOVED, [ calleeName ] );
	this._calleeListenerRegistry.sendToSubscribers( CALLEE_UPDATE_EVENT, message, socketWrapper );
};

/**
 * Adds a callee to the registry
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
WebRtcHandler.prototype._registerCallee = function( socketWrapper, message ) {
	if( this._validateMessage( socketWrapper, message, 1 ) ) {
		this._calleeRegistry.subscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Removes a callee from to the registry
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
WebRtcHandler.prototype._unregisterCallee = function( socketWrapper, message ) {
	if( this._validateMessage( socketWrapper, message, 1 ) ) {
		this._calleeRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Forwards a message from the sender to a receiver. The data array for every message
 * that relates to a WebRTC call has the same format [ <senderId>, <receiverId>, <data> ]
 *
 * This method finds the related sender and receiver and forwards the message
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
WebRtcHandler.prototype._forwardMessage = function( socketWrapper, message ) {
	if( !this._validateMessage( socketWrapper, message, 3 ) ) {
		return;
	}

	var senderName = message.data[ 0 ],
		receiverName = message.data[ 1 ],
		data = message.data[ 2 ];

	// Response
	if( this._callInitiatiorRegistry.hasSubscribers( receiverName ) ){
		this._callInitiatiorRegistry.sendToSubscribers( receiverName, message.raw );
	}

	// Request
	else {
		if( !this._calleeRegistry.hasSubscribers( receiverName ) ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_CALLEE, receiverName );
			socketWrapper.sendError( C.TOPIC.WEBRTC, C.EVENT.UNKNOWN_CALLEE, receiverName );
			return;
		}

		if( !this._callInitiatiorRegistry.hasSubscribers( senderName ) ) {
			this._callInitiatiorRegistry.subscribe( senderName, socketWrapper );
		}

		this._calleeRegistry.sendToSubscribers( receiverName, message.raw, socketWrapper );
	}
};

/**
 * Once a message with an action that ends a call is received, the related receiver
 * is removed from the list of call-initiators
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
WebRtcHandler.prototype._clearInitiator = function( socketWrapper, message ) {
	var subscribers;
	var subscriberId;
	if( this._callInitiatiorRegistry.hasSubscribers( message.data[ 0 ] ) ) {
		subscriberId =  message.data[ 0 ];
	} else if( this._callInitiatiorRegistry.hasSubscribers( message.data[ 1 ] ) ) {
		subscriberId =  message.data[ 1 ];
	}

	if( subscriberId ) {
		subscribers = this._callInitiatiorRegistry.getSubscribers( subscriberId );
		this._callInitiatiorRegistry.unsubscribe( subscriberId, subscribers[ 0 ] );
	}
};

/**
 * Reply with whether the client is still connected. Useful for determining
 * if the remoteCaller is no longer available.
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and validated deepstream message
 *
 * @private
 * @returns {void}
 */
WebRtcHandler.prototype._checkIsAlive = function( socketWrapper, message ) {
	var isAlive;
	var remoteId = message.data[ 0 ];

	if( message.data.length !== 1 || typeof remoteId !== 'string' ) {
		socketWrapper.sendError( C.TOPIC.WEBRTC, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	isAlive = this._callInitiatiorRegistry.hasSubscribers( remoteId ) || this._calleeRegistry.hasSubscribers( remoteId );
	socketWrapper.sendMessage( C.TOPIC.WEBRTC, C.ACTIONS.WEBRTC_IS_ALIVE, [ remoteId, isAlive ] );
};


/**
 * Checks messages for the right format
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Object} message parsed and validated deepstream message
 * @param 	{Number} dataLength The expected length of the data array
 *
 * @private
 * @returns {Boolean} isValid
 */
WebRtcHandler.prototype._validateMessage = function( socketWrapper, message, dataLength ) {
	var isValidMessage = message.data.length === dataLength;

	for( var i = 0; i < message.data.length; i++ ) {
		if( typeof message.data[ i ] !== 'string' ) {
			isValidMessage = false;
		}
	}

	if( !isValidMessage ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		socketWrapper.sendError( C.TOPIC.WEBRTC, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return false;
	} else {
		return true;
	}
};

module.exports = WebRtcHandler;