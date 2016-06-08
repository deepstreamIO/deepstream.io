var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	ListenerRegistry = require( '../utils/listener-registry' ),
	messageParser = require( '../message/message-parser' ),
	messageBuilder = require( '../message/message-builder' ),
	STRING = 'string';

/**
 * Handles incoming and outgoing messages for the EVENT topic.
 *
 * @param {Object} options deepstream options
 *
 * @constructor
 */
var EventHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.EVENT );
	this._listenerRegistry = new ListenerRegistry( C.TOPIC.EVENT, options, this._subscriptionRegistry );
	this._subscriptionRegistry.setSubscriptionListener( this._listenerRegistry );
};

/**
 * The main distribution method. Routes messages to functions
 * based on the provided action parameter of the message
 *
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 *
 * @public
 * @returns {void}
 */
EventHandler.prototype.handle = function( socketWrapper, message ) {
	if( message.action === C.ACTIONS.SUBSCRIBE ) {
		this._addSubscriber( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._removeSubscriber( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.EVENT ) {
		this._triggerEvent( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.LISTEN_SNAPSHOT ) {
		this._listenerRegistry.sendSnapshot( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.LISTEN ) {
		this._listenerRegistry.addListener( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UNLISTEN ) {
		this._listenerRegistry.removeListener( socketWrapper, message );
	}

	else {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );

		if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
			socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
		}
	}
};

/**
 * Handler for the SUBSCRIBE action. Adds the socketWrapper as
 * a subscriber to the specified event name
 *
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 *
 * @private
 * @returns {void}
 */
EventHandler.prototype._addSubscriber = function( socketWrapper, message ) {
	if( this._validateSubscriptionMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.subscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Handler for the UNSUBSCRIBE action. Removes the socketWrapper as
 * a subscriber from the specified event name
 *
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 *
 * @private
 * @returns {void}
 */
EventHandler.prototype._removeSubscriber = function( socketWrapper, message ) {
	if( this._validateSubscriptionMessage( socketWrapper, message ) ) {
		this._subscriptionRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
	}
};

/**
 * Notifies subscribers of events. This method is invoked for the EVENT action. It can
 * be triggered by messages coming in from both clients and the message connector.
 *
 * @param {String|SocketWrapper} messageSource If messageSource is the constant SOURCE_MESSAGE_CONNECTOR
 * 												the message was received from the message connector
 *
 * @param {Object} message parsed and permissioned deepstream message
 *
 * @private
 * @returns {void}
 */
EventHandler.prototype._triggerEvent = function( messageSource, message ) {
	if( typeof message.data[ 0 ] !== STRING ) {
		if( messageSource !== C.SOURCE_MESSAGE_CONNECTOR ) {
			messageSource.sendError( C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		}
		return;
	}

	this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.TRIGGER_EVENT, message.raw );

	if( messageSource !== C.SOURCE_MESSAGE_CONNECTOR ) {
		this._options.messageConnector.publish( C.TOPIC.EVENT, message );
	}

	if( this._options.dataTransforms && this._options.dataTransforms.has( C.TOPIC.EVENT, C.ACTIONS.EVENT ) ) {
		var receivers = this._subscriptionRegistry.getSubscribers( message.data[ 0 ] );

		if( receivers ) {
			receivers.forEach( this._sendTransformedMessage.bind( this, message, messageSource ) );
		}
	} else {
		var outboundMessage = messageBuilder.getMsg( C.TOPIC.EVENT, C.ACTIONS.EVENT, message.data );
		this._subscriptionRegistry.sendToSubscribers( message.data[ 0 ], outboundMessage, messageSource );
	}
};

/**
 * Applies a data-transform to each individial message before sending it out to its receiver. This method
 * parses the provided data for every client to avoid accidental manipulation of the original data object
 *
 * @param   {Object} originalMessage a deepstream event message object
 * @param   {SocketWrapper |String} messageSource   the endpoint the message was received from. Can be C.SOURCE_MESSAGE_CONNECTOR
 * @param   {SocketWrapper} receiver A socket that's subscribed to this event
 *
 * @private
 * @returns {void}
 */
EventHandler.prototype._sendTransformedMessage = function( originalMessage, messageSource, receiver ) {
	if( receiver === messageSource ) {
		return;
	}

	var eventName = originalMessage.data[ 0 ],
		metaData = {},
		data = messageParser.convertTyped( originalMessage.data[ 1 ] );

	metaData.sender = messageSource === C.SOURCE_MESSAGE_CONNECTOR ? C.SOURCE_MESSAGE_CONNECTOR : messageSource.user;
	metaData.receiver = receiver.user;
	metaData.eventName = eventName;

	data = this._options.dataTransforms.apply( C.TOPIC.EVENT, C.ACTIONS.EVENT, data, metaData );
	receiver.sendMessage( C.TOPIC.EVENT, C.ACTIONS.EVENT, [ eventName, messageBuilder.typed( data ) ]);
};

/**
 * Makes sure that subscription message contains the name of the event. Sends an error to the client
 * if not
 *
 * @param {SocketWrapper} socketWrapper
 * @param {Object} message parsed and permissioned deepstream message
 *
 * @private
 * @returns {Boolean} is valid subscription message
 */
EventHandler.prototype._validateSubscriptionMessage = function( socketWrapper, message ) {
	if( message.data && message.data.length === 1 && typeof message.data[ 0 ] === STRING ) {
		return true;
	} else {
		socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return false;
	}
};

module.exports = EventHandler;
