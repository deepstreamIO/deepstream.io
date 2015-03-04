var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	messageParser = require( '../message/message-parser' ),
	messageBuilder = require( '../message/message-builder' );

var ListenerRegistry = function( options, recordSubscriptionRegistry ) {
	this._options = options;
	this._recordSubscriptionRegistry = null;
	this._recordSubscriptionRegistry = recordSubscriptionRegistry;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RECORD );
	this._patterns = {};
};

/**
 * Register a client as a listener for record subscriptions
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
ListenerRegistry.prototype.addListener = function( socketWrapper, message ) {
	var pattern = this._getPattern( socketWrapper, message ),
		regExp,
		existingSubscriptions,
		recordName,
		i;
	
	if( !pattern ) {
		return;
	}

	try{
		regExp = new RegExp( pattern );
	} catch( e ) {
		this._onMsgDataError( socketWrapper, e.toString() );
		return;
	}
	
	if( !this._subscriptionRegistry.isSubscriber( socketWrapper ) ) {
		socketWrapper.socket.once( 'close', this._reconcilePatterns.bind( this ) );
	}

	this._subscriptionRegistry.subscribe( pattern, socketWrapper );
	
	// Create pattern entry (if it doesn't exist already)
	if( !this._patterns[ pattern ] ) {
		this._patterns[ pattern ] = { regExp: regExp, hasSubscribers: false };
	}
	
	// Notify socketWrapper of existing subscriptions that match the provided pattern
	existingSubscriptions = this._recordSubscriptionRegistry.getNames();
	for( i = 0; i < existingSubscriptions.length; i++ ) {
		recordName = existingSubscriptions[ i ];
		if( recordName.match( regExp ) ) {
			socketWrapper.send( messageBuilder.getMsg( C.TOPIC.RECORD, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ pattern, recordName ] ) );
		}
	}
};

/**
 * De-register a client as a listener for record subscriptions
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
ListenerRegistry.prototype.removeListener = function( socketWrapper, message ) {
	var pattern = this._getPattern( socketWrapper, message );

	if( pattern ) {
		this._subscriptionRegistry.unsubscribe( pattern, socketWrapper );
		this._reconcilePatterns();
	}
};

ListenerRegistry.prototype.onSubscriptionMade = function( recordName ) {
	var pattern, message;

	for( pattern in this._patterns ) {
		if( recordName.match( this._patterns[ pattern ].regExp ) ) {
			this._patterns[ pattern ].hasSubscribers = true;
			message = messageBuilder.getMsg( C.TOPIC.RECORD, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ pattern, recordName ] );
			this._subscriptionRegistry.sendToSubscribers( pattern, message );
		}
	}
};

ListenerRegistry.prototype.onSubscriptionRemoved = function( recordName ) {

};

ListenerRegistry.prototype._getPattern = function( socketWrapper, message ) {
	if( message.data.length !== 1 ) {
		this._onMsgDataError( socketWrapper, message.raw );
		return null;
	}

	var pattern = message.data[ 0 ];

	if( typeof pattern !== 'string' ) {
		this._onMsgDataError( socketWrapper, pattern );
		return null;
	}

	return pattern;
};

ListenerRegistry.prototype._onMsgDataError = function( socketWrapper, errorMsg ) {
	socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, errorMsg );
	this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.INVALID_MESSAGE_DATA, errorMsg );
};

ListenerRegistry.prototype._reconcilePatterns = function() {
	for( var pattern in this._patterns ) {
		if( !this._subscriptionRegistry.hasSubscribers( pattern ) ) {
			delete this._patterns[ pattern ];
		}
	}
};

module.exports = ListenerRegistry;