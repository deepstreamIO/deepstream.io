var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' );

var WebRtcHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( this._options, C.TOPIC.WEBRTC );
	this._callInitiatior = {};
	this._forwardActions = [
		C.ACTIONS.WEBRTC_OFFER,
		C.ACTIONS.WEBRTC_ANSWER,
		C.ACTIONS.WEBRTC_ICE_CANDIDATE,
		C.ACTIONS.WEBRTC_CALL_DECLINED
	];
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
	else if( this._forwardActions.indexOf( message.action ) !== -1 ) {
		this._forwardMessage( socketWrapper, message);
	}
	else {
		socketWrapper.sendError( C.TOPIC.WEBRTC, C.EVENT.UNKNOWN_ACTION, message.action );
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.raw );
	}
};

WebRtcHandler.prototype._registerCallee = function( socketWrapper, message ) {
	if( !this._validateMessage( socketWrapper, message, 1 ) ) {
		return;
	}

	this._subscriptionRegistry.subscribe( message.data[ 0 ], socketWrapper );
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
		this._callInitiatior[ receiverName ].socketWrapper.send( message.raw );
	} 

	// Request
	else {
		if( !this._subscriptionRegistry.hasSubscribers( receiverName ) ) {
			socketWrapper.sendError( C.TOPIC.WEBRTC, C.EVENT.UNKNOWN_CALLEE, receiverName );
			return;
		}
	
		if( !this._callInitiatior[ senderName ] ) {
			this._callInitiatior[ senderName ] = {
				timeout: setTimeout( this._clearInitiator.bind( this, senderName ), this._options.webrtcEstablishCallTimeout ),
				socketWrapper: socketWrapper
			};
		}

		this._subscriptionRegistry.sendToSubscribers( receiverName, message.raw, socketWrapper );
	}
	
};

WebRtcHandler.prototype._clearInitiator = function( senderName ) {
	if( this._callInitiatior[ senderName ] ) {
		clearTimeout( this._callInitiatior[ senderName ].timeout );
		delete this._callInitiatior[ senderName ];
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