var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	messageBuilder = require( '../message/message-builder' ),
	CALLEE_UPDATE_EVENT = 'callee-update',
	FORWARD_ACTIONS = [
		C.ACTIONS.WEBRTC_OFFER,
		C.ACTIONS.WEBRTC_ANSWER,
		C.ACTIONS.WEBRTC_ICE_CANDIDATE
	],
	FINAL_ACTIONS = [
		C.ACTIONS.WEBRTC_CALL_DECLINED,
		C.ACTIONS.WEBRTC_CALL_ENDED
	];

var WebRtcHandler = function( options ) {
	this._options = options;
	this._calleeRegistry = new SubscriptionRegistry( this._options, C.TOPIC.WEBRTC, this );
	this._calleeListenerRegistry = new SubscriptionRegistry( this._options, C.TOPIC.WEBRTC );
	this._callInitiatior = {};
};

/**
 * Handles RPC messages
 *
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
	else if( FORWARD_ACTIONS.indexOf( message.action ) !== -1 ) {
		this._forwardMessage( socketWrapper, message);
	}
	else if( FINAL_ACTIONS.indexOf( message.action ) !== -1 ) {
		this._forwardMessage( socketWrapper, message );
		this._clearInitiator( message );
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

WebRtcHandler.prototype.onSubscriptionMade = function( calleeName, socketWrapper ) {
	var message = messageBuilder.getMsg( C.TOPIC.WEBRTC, C.ACTIONS.WEBRTC_CALLEE_ADDED, [ calleeName ] );
	this._calleeListenerRegistry.sendToSubscribers( CALLEE_UPDATE_EVENT, message, socketWrapper );
};

WebRtcHandler.prototype.onSubscriptionRemoved = function( calleeName, socketWrapper ) {
	var message = messageBuilder.getMsg( C.TOPIC.WEBRTC, C.ACTIONS.WEBRTC_CALLEE_REMOVED, [ calleeName ] );
	this._calleeListenerRegistry.sendToSubscribers( CALLEE_UPDATE_EVENT, message, socketWrapper );
};

WebRtcHandler.prototype._registerCallee = function( socketWrapper, message ) {
	if( !this._validateMessage( socketWrapper, message, 1 ) ) {
		return;
	}
	this._calleeRegistry.subscribe( message.data[ 0 ], socketWrapper );
};

WebRtcHandler.prototype._forwardMessage = function( socketWrapper, message ) {
	if( !this._validateMessage( socketWrapper, message, 3 ) ) {
		return;
	}

	var senderName = message.data[ 0 ],
		receiverName = message.data[ 1 ],
		data = message.data[ 2 ];

	// Response
	if( this._callInitiatior[ receiverName ] ){
		this._callInitiatior[ receiverName ].send( message.raw );
	} 

	// Request
	else {
		if( !this._calleeRegistry.hasSubscribers( receiverName ) ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_CALLEE, receiverName );
			socketWrapper.sendError( C.TOPIC.WEBRTC, C.EVENT.UNKNOWN_CALLEE, receiverName );
			return;
		}
	
		if( !this._callInitiatior[ senderName ] ) {
			this._callInitiatior[ senderName ] = socketWrapper;
		}

		this._calleeRegistry.sendToSubscribers( receiverName, message.raw, socketWrapper );
	}
};

WebRtcHandler.prototype._clearInitiator = function( message ) {
	if( this._callInitiatior[ message.data[ 0 ] ] ) {
		delete this._callInitiatior[ message.data[ 0 ] ];
	}

	if( this._callInitiatior[ message.data[ 1 ] ] ) {
		delete this._callInitiatior[ message.data[ 1 ] ];
	}
};

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