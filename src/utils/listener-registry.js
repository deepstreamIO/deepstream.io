var C = require( '../constants/constants' ),
  SubscriptionRegistry = require( '../utils/subscription-registry' ),
  messageParser = require( '../message/message-parser' ),
  messageBuilder = require( '../message/message-builder' );

/**
 * Deepstream.io allows clients to register as listeners for subscriptions.
 * This allows for the creation of 'active' data-providers,
 * e.g. data providers that provide data on the fly, based on what clients
 * are actually interested in.
 *
 * When a client registers as a listener, it provides a regular expression.
 * It will then immediatly get a number of callbacks for existing record subscriptions
 * whose names match that regular expression.
 *
 * After that, whenever a record with a name matching that regular expression is subscribed
 * to for the first time, the listener is notified.
 *
 * Whenever the last subscription for a matching record is removed, the listener is also
 * notified with a SUBSCRIPTION_FOR_PATTERN_REMOVED action
 *
 * This class manages the matching of patterns and record names. The subscription /
 * notification logic is handled by this._subscriptionRegistry
 *
 * @constructor
 *
 * @param {Object} options                    DeepStream options
 * @param {SubscriptionRegistry} parentSubscriptionRegistry The SubscriptionRegistry containing the record subscriptions
 *                                                          to allow new listeners to be notified of existing subscriptions
 */
var ListenerRegistry = function( type, options, parentSubscriptionRegistry ) {
  this._type = type;
  this._options = options;
  this._parentSubscriptionRegistry = parentSubscriptionRegistry;
  this._subscriptionRegistry = new SubscriptionRegistry( options, this._type );
  this._subscriptionRegistry.setAction( 'subscribe', C.ACTIONS.LISTEN );
  this._subscriptionRegistry.setAction( 'unsubscribe', C.ACTIONS.UNLISTEN );
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
    name,
    i;

  regExp = this._validatePattern( socketWrapper, pattern );

  if( !regExp ) {
    return;
  }

  var inSubscriptionRegistry = this._subscriptionRegistry.isSubscriber( socketWrapper );
  this._subscriptionRegistry.subscribe( pattern, socketWrapper );
  if( !inSubscriptionRegistry ) {
    socketWrapper.socket.once( 'close', this._reconcilePatterns.bind( this ) );
  }

  // Create pattern entry (if it doesn't exist already)
  if( !this._patterns[ pattern ] ) {
    this._patterns[ pattern ] = regExp;
  }

  // Notify socketWrapper of existing subscriptions that match the provided pattern
  existingSubscriptions = this._parentSubscriptionRegistry.getNames();
  for( i = 0; i < existingSubscriptions.length; i++ ) {
    name = existingSubscriptions[ i ];
    if( name.match( regExp ) ) {
      socketWrapper.send( messageBuilder.getMsg( this._type, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ pattern, name ] ) );
    }
  }
};

/**
 * Send a snapshot of all the names that match the provided pattern
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
ListenerRegistry.prototype.sendSnapshot = function( socketWrapper, message ) {
	var i, matchingNames = [];
  var pattern = this._getPattern( socketWrapper, message );
  var existingSubscriptions = this._parentSubscriptionRegistry.getNames();
  var regExp = this._validatePattern( socketWrapper, pattern );

  if( !regExp ) {
    return;
  }

  for( i = 0; i < existingSubscriptions.length; i++ ) {
    name = existingSubscriptions[ i ];
    if( name.match( regExp ) ) {
      matchingNames.push( name );
    }
  }
  socketWrapper.send( messageBuilder.getMsg( this._type, C.ACTIONS.SUBSCRIPTIONS_FOR_PATTERN_FOUND, [ pattern, matchingNames ] ) );
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

/**
 * Called by the record subscription registry whenever a subscription
 * is made for the first time. Part of the subscriptionListener interface.
 *
 * @param   {String} name
 *
 * @public
 * @returns {void}
 */
ListenerRegistry.prototype.onSubscriptionMade = function( name ) {
  this._sendUpdate( name, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND );
};

/**
 * Called by the record subscription registry whenever the last
 * subscription for a record had been removed. Part of the subscriptionListener interface.
 *
 * @param   {String} name
 *
 * @public
 * @returns {void}
 */
ListenerRegistry.prototype.onSubscriptionRemoved = function( name ) {
  this._sendUpdate( name, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED );
};

/**
 * Sends a SUBSCRIPTION_FOR_PATTERN_FOUND or SUBSCRIPTION_FOR_PATTERN_REMOVED message
 * to all interested listeners
 *
 * @param   {String} name
 * @param   {String} action
 *
 * @public
 * @returns {void}
 */
ListenerRegistry.prototype._sendUpdate = function( name, action ) {
  var pattern, message;

  for( pattern in this._patterns ) {
    if( this._patterns[ pattern ].test( name ) ) {
      message = messageBuilder.getMsg( this._type, action, [ pattern, name ] );
      this._subscriptionRegistry.sendToSubscribers( pattern, message );
    }
  }
};

/**
 * Extracts the subscription pattern from the message and notifies the sender
 * if something went wrong
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message
 *
 * @private
 * @returns {void}
 */
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

/**
 * Validates that the pattern is not empty and is a valid regular expression
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {String} pattern
 *
 * @private
 * @returns {RegExp}
 */
ListenerRegistry.prototype._validatePattern = function( socketWrapper, pattern ) {
  if( !pattern ) {
    return;
  }

  try{
    return new RegExp( pattern );
  } catch( e ) {
    this._onMsgDataError( socketWrapper, e.toString() );
    return;
  }
};

/**
 * Processes errors for invalid messages
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {String} errorMsg
 *
 * @private
 * @returns {void}
 */
ListenerRegistry.prototype._onMsgDataError = function( socketWrapper, errorMsg ) {
  socketWrapper.sendError( this._type, C.EVENT.INVALID_MESSAGE_DATA, errorMsg );
  this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.INVALID_MESSAGE_DATA, errorMsg );
};

/**
 * Clean-up for pattern subscriptions. If a connection is lost or a listener removes
 * this makes sure that the internal pattern array stays in sync with the subscription
 * registry
 *
 * @private
 * @returns {void}
 */
ListenerRegistry.prototype._reconcilePatterns = function() {
  for( var pattern in this._patterns ) {
    if( !this._subscriptionRegistry.hasSubscribers( pattern ) ) {
      delete this._patterns[ pattern ];
    }
  }
};

module.exports = ListenerRegistry;