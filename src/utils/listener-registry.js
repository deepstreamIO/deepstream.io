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
  this._providedRecords = {};
  this._listenInProgress = {};
};

/*
TODO
*/

ListenerRegistry.prototype.handle = function( socketWrapper, message ) {
  if (message.action === C.ACTIONS.LISTEN ) {
    this.addListener( socketWrapper, message );
  } else if (message.action === C.ACTIONS.UNLISTEN ) {
    this.removeListener( socketWrapper, message );
  } else if( this._listenInProgress[ message.data[ 1 ] ] ) {
    if (message.action === C.ACTIONS.LISTEN_ACCEPT ) {
      this._providedRecords[ message.data[ 1 ] ] = {
        socketWrapper: socketWrapper,
        pattern: message.data[ 0 ]
      }
      // tell all subscribers that this is being published
      delete this._listenInProgress[ message.data[ 1 ] ];
      // TODO: clear timeout
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      // try next listener
      this.triggerNextProvider( message.data[ 1 ] );
    }
  } else {
    console.log(message)
    console.error(new Error('TODO').stack)
    // send error that accepting or rejecting listen pattern / subscription
    // that isn't being asked for
  }


}

/*
TODO
*/

ListenerRegistry.prototype.hasActiveProvider = function( susbcriptionName ) {
  return !!this._providedRecords[ susbcriptionName ];
}

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
  console.log('existingSubscriptions', existingSubscriptions)
  for( i = 0; i < existingSubscriptions.length; i++ ) {
    name = existingSubscriptions[ i ];
    console.log('name.match', name, regExp)
    if( name.match( regExp ) ) {
      console.log('this._listenInProgress', this._listenInProgress)
      if( this._listenInProgress[ name ] ) {
        console.log('listen in progress')
        this._listenInProgress[ name ].push({
          socketWrapper: socketWrapper,
          pattern: pattern
        });
      } else {
        this._listenInProgress[ name ] = [];
        socketWrapper.send( messageBuilder.getMsg( this._type, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ pattern, name ] ) );
      }
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

  var name;
  for( name in this._listenInProgress ) {
    for( var i=0; i<this._listenInProgress[name].length; i++) {
      if(
        this._listenInProgress[name][i].socketWrapper === socketWrapper &&
        this._listenInProgress[name][i].pattern === pattern
      ) {
        this._listenInProgress[name].splice( i, 1);
      }
    }
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
  var pattern, message;
  var action = C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND;

  this._listenInProgress[ name ] = [];

  for( pattern in this._patterns ) {
    if( this._patterns[ pattern ].test( name ) ) {
      var providersForPattern = this._subscriptionRegistry.getSubscribers( pattern );
      for( var i = 0; i < providersForPattern.length; i++ ) {
        this._listenInProgress[ name ].push( {
          pattern: pattern,
          socketWrapper: providersForPattern[ i ]
        });
      }
    }
  }
  this.triggerNextProvider( name );
};

ListenerRegistry.prototype.triggerNextProvider = function ( name ) {
  // TODO: creat a timeout, if timeout happens -> treat it as a reject
  var provider = (this._listenInProgress[ name ] || []).shift();
  if( provider ) {
    provider.socketWrapper.send( messageBuilder.getMsg(
      this._type, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ provider.pattern, name ]
      )
    );
  }
}

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
  var provider = this._providedRecords[ name ];
  if ( provider == null ) {
    return;
  }
  provider.socketWrapper.send(
    messageBuilder.getMsg(
      this._type, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ provider.pattern, name ]
    )
  );
  delete this._providedRecords[ name ];
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
