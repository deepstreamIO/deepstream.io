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
 * notification logic is handled by this._providerRegistry
 *
 * @constructor
 *
 * @param {Object} options                    DeepStream options
 * @param {SubscriptionRegistry} clientRegistry The SubscriptionRegistry containing the record subscriptions
 *                                               to allow new listeners to be notified of existing subscriptions
 */
var ListenerRegistry = function( type, options, clientRegistry ) {
  this._type = type;
  this._options = options;
  this._clientRegistry = clientRegistry;
  this._providerRegistry = new SubscriptionRegistry( options, this._type );
  this._providerRegistry.setAction( 'subscribe', C.ACTIONS.LISTEN );
  this._providerRegistry.setAction( 'unsubscribe', C.ACTIONS.UNLISTEN );
  this._patterns = {};
  this._providedRecords = {};
  this._listenInProgress = {};
  this._timeoutMap = {};
  this._timedoutProviders = {};
};

/*
TODO
*/

ListenerRegistry.prototype.handle = function( socketWrapper, message ) {
  var pattern = message.data[ 0 ];
  var subscriptionName = message.data[ 1 ];
  var indexOfTimedoutProvider = (this._timedoutProviders[ subscriptionName ] || []).findIndex( function( provider ) {
    return provider.socketWrapper === socketWrapper && provider.pattern === pattern;
  });
  var timedoutButReadyProvider = (this._timedoutProviders[ subscriptionName ] || []).filter( provider => provider.isReady )[0]
  // console.log(socketWrapper.toString(), message, this._listenInProgress)
  if (message.action === C.ACTIONS.LISTEN ) {
    this.addListener( socketWrapper, message );
  } else if (message.action === C.ACTIONS.UNLISTEN ) {
    this.removeListener( socketWrapper, message );
  } else if( this._timedoutProviders[ subscriptionName ] && indexOfTimedoutProvider !== -1) {
    if ( message.action === C.ACTIONS.LISTEN_ACCEPT || message.action === C.ACTIONS.LISTEN_REJECT ) {
      var provider = this._timedoutProviders[ subscriptionName ][ indexOfTimedoutProvider ];
      provider.isReady = true;
      provider.action = message.action
      provider.pattern = pattern
    }
  } else if( this._listenInProgress[ subscriptionName ] ) {
    if (message.action === C.ACTIONS.LISTEN_ACCEPT ) {
      this.accept( socketWrapper, message );
      if( timedoutButReadyProvider ) {
        var index = this._timedoutProviders[ subscriptionName ].indexOf( timedoutButReadyProvider );
        this._timedoutProviders[ subscriptionName ].splice( index, 1 );
        if( timedoutButReadyProvider.action === C.ACTIONS.LISTEN_ACCEPT ) {
          timedoutButReadyProvider.socketWrapper.send(
            messageBuilder.getMsg(
              this._type,
              C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
              [ timedoutButReadyProvider.pattern, subscriptionName ]
            )
          );
        }
      }
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      if( timedoutButReadyProvider ) {
        var index = this._timedoutProviders[ subscriptionName ].indexOf( timedoutButReadyProvider );
        this._timedoutProviders[ subscriptionName ].splice( index, 1 );
        if( timedoutButReadyProvider.action === C.ACTIONS.LISTEN_ACCEPT ) {
          this.accept( timedoutButReadyProvider.socketWrapper, message );
        }
      } else {
        this.triggerNextProvider( subscriptionName );
      }
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

ListenerRegistry.prototype.accept = function( socketWrapper, message ) {
  var pattern = message.data[ 0 ];
  var subscriptionName = message.data[ 1 ];
  this._providedRecords[ subscriptionName ] = {
    socketWrapper: socketWrapper,
    pattern: pattern
  }

  this._clientRegistry.sendToSubscribers(
    subscriptionName,
    createHasProviderMessage( true, this._type, subscriptionName )
  );

  socketWrapper.socket.once( 'close', (function() {
    this._clientRegistry.sendToSubscribers(
      subscriptionName,
      createHasProviderMessage( false,  this._type, subscriptionName )
    );
  }).bind( this ) );

  // clear timeout for other providers
  clearTimeout( this._timeoutMap[ subscriptionName ] );
  delete this._listenInProgress[ subscriptionName ];
}

function createHasProviderMessage(hasProvider, type, subscriptionName) {
  return messageBuilder.getMsg(
      type,
      C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
      [subscriptionName, (hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE)]
    );
}

/*
 provider 1 times out
 provider 2 times out
 provider 3 accepts -> set
*/

/*
TODO
*/

ListenerRegistry.prototype.hasActiveProvider = function( susbcriptionName ) {
  // do i have a local provider ( i know the provider pattern, the subscription name and the provider socket
  // does any other deepstream node actually provide this subscriptionName
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

  var inSubscriptionRegistry = this._providerRegistry.isSubscriber( socketWrapper );

  if( !inSubscriptionRegistry ) {
    this._providerRegistry.subscribe( pattern, socketWrapper );
    socketWrapper.socket.once( 'close', this._reconcilePatterns.bind( this ) );
  }

  // Create pattern entry (if it doesn't exist already)
  if( !this._patterns[ pattern ] ) {
    this._patterns[ pattern ] = regExp;
  }

  // Notify socketWrapper of existing subscriptions that match the provided pattern
  existingSubscriptions = this._clientRegistry.getNames();
  for( i = 0; i < existingSubscriptions.length; i++ ) {
    name = existingSubscriptions[ i ];
    if( name.match( regExp ) ) {
      if( this._listenInProgress[ name ] ) {
        // if already in queue do not add
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

  // now do the same thing but with remote subscriptions
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
  var existingSubscriptions = this._clientRegistry.getNames();
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
    this._providerRegistry.unsubscribe( pattern, socketWrapper );
    this._reconcilePatterns();
  }

  var name;
  for( name in this._listenInProgress ) {
    for( var i=0; i<this._listenInProgress[name].length; i++) {
      if(
        this._listenInProgress[name][i].socketWrapper === socketWrapper &&
        this._listenInProgress[name][i].pattern === pattern
      ) {
        this._listenInProgress[name].splice( i, 1 );
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
ListenerRegistry.prototype.onSubscriptionMade = function( name, socketWrapper, count ) {
  var pattern, message;
  var action = C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND;

  if( this.hasActiveProvider( name ) ) {
    socketWrapper.send( messageBuilder.getMsg(
      this._type, C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, [ name, C.TYPES.TRUE ]
    ) );
    return;
  }
  this.createListenMap( pattern, name );

  this.triggerNextProvider( name );
};

ListenerRegistry.prototype.createListenMap = function ( pattern, name ) {
  // Creating the map
  this._listenInProgress[ name ] = [];
  for( pattern in this._patterns ) {
    if( this._patterns[ pattern ].test( name ) ) {
      var providersForPattern = this._providerRegistry.getSubscribers( pattern );
      for( var i = 0; i < providersForPattern.length; i++ ) {
        this._listenInProgress[ name ].push( {
          pattern: pattern,
          socketWrapper: providersForPattern[ i ]
        });
      }
    }
  }
}

ListenerRegistry.prototype.triggerNextProvider = function ( name ) {
  var provider = (this._listenInProgress[ name ] || []).shift();

  if( provider ) {
    var timeoutId = setTimeout((function() {
      // console.log('timing out now', provider.pattern)
      if( this._timedoutProviders[ name ] == null ) {
        this._timedoutProviders[ name ] = [];
      }
      this._timedoutProviders[ name ].push( provider );
      this.triggerNextProvider( name );
    }).bind( this ), 20 );
    this._timeoutMap[ name ] = timeoutId;
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
ListenerRegistry.prototype.onSubscriptionRemoved = function( name, socketWrapper, count ) {
  // if there is no provider OR someone else is already listening (provider)
  // ensure that clients always initialize the the provider before a normal read
  if( !this.hasActiveProvider( name ) || count > 1 ) {
    return;
  }

  // if there is still one proivder which is not the passed socketWrapper
  if( count === 1 && this._providedRecords[ name ].socketWrapper !== socketWrapper) {
    return;
  }

  var provider = this._providedRecords[ name ];
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
    if( !this._providerRegistry.hasSubscribers( pattern ) ) {
      delete this._patterns[ pattern ];
    }
  }
};

module.exports = ListenerRegistry;
