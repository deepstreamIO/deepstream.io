var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	messageBuilder = require( '../message/message-builder' );

var EventHandler = function( connectionEndpoint, options ) {
	this._connectionEndpoint = connectionEndpoint;
	this._subscriptionRegistry = new SubscriptionRegistry( options );
};

EventHandler.prototype.handle = function( socketWrapper, message ) {
	if( message.action === C.ACTIONS.SUBSCRIBE ) {
		this._addSubscriber( socketWrapper, message );
	}

	if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._removeSubscriber( socketWrapper, message );
	}

	if( message.action === C.ACTIONS.EVENT ) {
		this._triggerEvent( socketWrapper, message );
	}
};

EventHandler.prototype._addSubscriber = function( socketWrapper, message ) {
	if( this._validateSubscriptionMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.subscribe( message.data[ 0 ], socketWrapper );
	}
};

EventHandler.prototype._removeSubscriber = function( socketWrapper, message ) {
	if( this._validateSubscriptionMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
	}
};

EventHandler.prototype._triggerEvent = function( socketWrapper, message ) {
	if( typeof message.data[ 0 ] !== 'string' ) {
		socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	var outboundMessage = messageBuilder.getMsg( C.TOPIC.EVENT, C.ACTIONS.EVENT, message.data );
	this._subscriptionRegistry.sendToSubscribers( message.data[ 0 ], outboundMessage, socketWrapper );
};

EventHandler.prototype._validateSubscriptionMessage = function( socketWrapper, message ) {
	if( message.data.length === 1 && typeof message.data[ 0 ] === 'string' ) {
		return true;
	} else {
		socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return false;
	}
};

module.exports = EventHandler;