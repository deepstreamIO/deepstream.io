'use strict';

var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	TimeoutRegistry = require( './listener-timeout-registry' ),
	messageParser = require( '../message/message-parser' ),
	messageBuilder = require( '../message/message-builder' );

class ListenerRegistry {
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
	 * @param {Object} options       DeepStream options
	 * @param {SubscriptionRegistry} clientRegistry The SubscriptionRegistry containing the record subscriptions
	 *                               to allow new listeners to be notified of existing subscriptions
	 */
	constructor( topic, options, clientRegistry ) {
		this._topic = topic;
		this._options = options;
		this._clientRegistry = clientRegistry;
		this._providerRegistry = new SubscriptionRegistry( options, this._topic );
		this._providerRegistry.setAction( 'subscribe', C.ACTIONS.LISTEN );
		this._providerRegistry.setAction( 'unsubscribe', C.ACTIONS.UNLISTEN );
		this._patterns = {};
		this._providedRecords = {};
		this._listenInProgress = {};
		this._listenerTimeoutRegistery = new TimeoutRegistry( topic, options );
		this._reconcilePatternsBound = this._reconcilePatterns.bind( this );
	}

	/**
	 * Used primarily for tests. Returns whether or not a provider exists for
	 * the specific subscriptionName
	 * @public
	 * @returns {boolean}
	 */
	hasActiveProvider( susbcriptionName ) {
		return !!this._providedRecords[ susbcriptionName ];
	}

	/**
	 * The main entry point toe the handle class.
	 * Called on any of the following actions:
	 * 1) C.ACTIONS.LISTEN
	 * 2) C.ACTIONS.UNLISTEN
	 * 3) C.ACTIONS.LISTEN_ACCEPT
	 * 4) C.ACTIONS.LISTEN_REJECT
	 * 5) C.ACTIONS.LISTEN_SNAPSHOT
	 *
	 * @param   {SocketWrapper} socketWrapper the socket that send the request
	 * @param   {Object} message parsed and validated message
	 *
	 * @public
	 * @returns {void}
	 */
	handle( socketWrapper, message ) {
		const pattern = message.data[ 0 ];
		const subscriptionName = message.data[ 1 ];
		if (message.action === C.ACTIONS.LISTEN_SNAPSHOT ) {
			this._sendSnapshot( socketWrapper, message );
		} else if (message.action === C.ACTIONS.LISTEN ) {
			this._addListener( socketWrapper, message );
		} else if (message.action === C.ACTIONS.UNLISTEN ) {
			this._removeListener( socketWrapper, message );
		} else if( this._listenerTimeoutRegistery.isALateResponder( socketWrapper, message ) ) {
			this._listenerTimeoutRegistery.handle( socketWrapper, message );
		} else if( this._listenInProgress[ subscriptionName ] ) {
			this._processResponseForListInProgress( socketWrapper, subscriptionName, message );
		} else {
			this._onMsgDataError( socketWrapper, message.raw, C.EVENT.INVALID_MESSAGE );
		}
	}

	/**
	* Process an accept or reject for a listen that is currently in progress
	* which hasn't timed out yet.
	*/
	_processResponseForListInProgress( socketWrapper, subscriptionName, message ) {
		if (message.action === C.ACTIONS.LISTEN_ACCEPT ) {
			this._accept( socketWrapper, message );
			this._listenerTimeoutRegistery.rejectLateResponderThatAccepted( subscriptionName );
			this._listenerTimeoutRegistery.clear( subscriptionName );
		} else if (message.action === C.ACTIONS.LISTEN_REJECT ) {
			const provider = this._listenerTimeoutRegistery.getLateResponderThatAccepted( subscriptionName );
			if( provider ) {
				this._accept( provider.socketWrapper, message );
				this._listenerTimeoutRegistery.clear( subscriptionName );
			} else {
				this._triggerNextProvider( subscriptionName );
			}
		}
	}

	/**
	 * Send a snapshot of all the names that match the provided pattern
	 *
	 * @param   {SocketWrapper} socketWrapper the socket that send the request
	 * @param   {Object} message parsed and validated message
	 *
	 * @private
	 * @returns {void}
	 */
	_sendSnapshot( socketWrapper, message ) {
		const matchingNames = [];
		const pattern = this._getPattern( socketWrapper, message );
		const existingSubscriptions = this._clientRegistry.getNames();
		const regExp = this._validatePattern( socketWrapper, pattern );
		var subscriptionName;

		if( !regExp ) {
			return;
		}

		for( var i = 0; i < existingSubscriptions.length; i++ ) {
			subscriptionName = existingSubscriptions[ i ];
			if( subscriptionName.match( regExp ) ) {
				matchingNames.push( subscriptionName );
			}
		}

		socketWrapper.send( messageBuilder.getMsg( this._topic, C.ACTIONS.SUBSCRIPTIONS_FOR_PATTERN_FOUND, [ pattern, matchingNames ] ) );
	}

	/**
	 * Called by the record subscription registry whenever the subscription count decrements.
	 * Part of the subscriptionListener interface.
	 *
	 * @param   {String} name
	 *
	 * @public
	 * @returns {void}
	 */
	onSubscriptionMade( name, socketWrapper, count ) {
		if( this.hasActiveProvider( name ) && this._topic === C.TOPIC.RECORD ) {
			socketWrapper.send( messageBuilder.getMsg(
				this._topic, C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, [ name, C.TYPES.TRUE ]
			) );
			return;
		}

		if( count > 1 ) {
			return;
		}

		this._createListenMap( name );
		this._triggerNextProvider( name );
	}

	/**
	 * Called by the record subscription registry whenever the subscription count increments.
	 * Part of the subscriptionListener interface.
	 *
	 * @param   {String} name
	 *
	 * @public
	 * @returns {void}
	 */
	onSubscriptionRemoved( subscriptionName, socketWrapper, count ) {
		const provider = this._providedRecords[ subscriptionName ];

		if( !provider ) {
			return;
		}

		if( count > 1 ) {
			return;
		}

		// provider discarded, but there is still another active subscriber
		if( count === 1 && provider.socketWrapper === socketWrapper) {
			return;
		}

		// provider isn't a subscriber, meaning we should wait for 0
		if( count === 1 && this._clientRegistry.getSubscribers().indexOf( provider.socketWrapper ) === -1 ) {
			return;
		}

		// stop providing
		this._sendHasProviderUpdate( false, subscriptionName );
		provider.socketWrapper.send(
			messageBuilder.getMsg(
				this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ provider.pattern, subscriptionName ]
			)
		);
		delete this._providedRecords[ subscriptionName ];
	}

	/**
	 * Register callback for when the server recieves an Accept message from the client
	 *
	 * @private
	 * @returns {void}
	 */
	_accept( socketWrapper, message ) {
		const subscriptionName = message.data[ 1 ];

		delete this._listenInProgress[ subscriptionName ];

		this._listenerTimeoutRegistery.clearTimeout( subscriptionName );

		this._providedRecords[ subscriptionName ] = {
			socketWrapper: socketWrapper,
			pattern: message.data[ 0 ],
			closeListener: this._removeListener.bind( this, socketWrapper, message )
		}
		socketWrapper.socket.once( 'close', this._providedRecords[ subscriptionName ].closeListener );

		this._sendHasProviderUpdate( true, subscriptionName );
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
	_addListener( socketWrapper, message ) {
		const pattern = this._getPattern( socketWrapper, message );
		const regExp = this._validatePattern( socketWrapper, pattern );

		if( !regExp ) {
			return;
		}

		const inSubscriptionRegistry = this._providerRegistry.isSubscriber( socketWrapper );
		if( !inSubscriptionRegistry ) {
			// this only allows one pattern for a listener!
			this._providerRegistry.subscribe( pattern, socketWrapper );
			this._addUniqueCloseListener( socketWrapper, this._reconcilePatternsBound );
		}

		// Create pattern entry (if it doesn't exist already)
		if( !this._patterns[ pattern ] ) {
			this._patterns[ pattern ] = regExp;
		}

		this._reconcileSubscriptionsToPatterns( regExp, pattern, socketWrapper );
	}

	_addUniqueCloseListener(socketWrapper, eventHandler) {
		var eventName = 'close';
		var socketListeners = socketWrapper.socket.listeners( eventName );
		var listenerFound = false;
		for( var i=0; i<socketListeners.length; i++) {
			var item = socketListeners[ i ];
			if( item.listener === eventHandler ) {
				listenerFound = true;
				break;
			}
		}
		if( !listenerFound ) {
			socketWrapper.socket.once( eventName, eventHandler );
		}
	}

	/**
	 * Find subscriptions that match pattern, and notify them that
	 * they can be provided.
	 *
	 * We will attempt to notify all possible providers rather than
	 * just the single provider for load balancing purposes and
	 * so that the one listener doesnt potentially get overwhelmed.
	 *
	 * @private
	 * @returns {Message}
	 */
	_reconcileSubscriptionsToPatterns( regExp, pattern, socketWrapper ) {
		const existingSubscriptions = this._clientRegistry.getNames();
		for( var i = 0; i < existingSubscriptions.length; i++ ) {
			var subscriptionName = existingSubscriptions[ i ];
			if( subscriptionName.match( regExp ) ) {
				const listenInProgress = this._listenInProgress[ subscriptionName ];
				if( this._providedRecords[ subscriptionName ] ) {
					continue;
				} else if( listenInProgress ) {
					listenInProgress.push( {
						socketWrapper: socketWrapper,
						pattern: pattern
					} );
				} else {
					this._createListenMap( subscriptionName );
					this._triggerNextProvider( subscriptionName );
				}
			}
		}
	}

	/**
	 * De-register a client as a listener for record subscriptions
	 *
	 * @param   {SocketWrapper} socketWrapper the socket that send the request
	 * @param   {Object} message parsed and validated message
	 *
	 * @private
	 * @returns {void}
	 */
	_removeListener( socketWrapper, message ) {
		const pattern = this._getPattern( socketWrapper, message );

		this._providerRegistry.unsubscribe( pattern, socketWrapper );
		this._reconcilePatterns();
		this._removeListenerFromInProgress( pattern, socketWrapper );
		this._removeListenerIfActive( pattern, socketWrapper );
	}

	/**
	 * Remove provider from listen in progress map if it unlistens during
	 * discovery stage
	 *
	 * @private
	 * @returns {Message}
	 */
	_removeListenerFromInProgress( pattern, socketWrapper ) {
		var subscriptionName, i, listenInProgress;
		for( var subscriptionName in this._listenInProgress ) {
			listenInProgress = this._listenInProgress[ subscriptionName ];
			for( var i=0; i< listenInProgress.length; i++) {
				if(
					listenInProgress[i].socketWrapper === socketWrapper &&
					listenInProgress[i].pattern === pattern
				) {
					listenInProgress.splice( i, 1 );
				}
			}
		}
	}

		/**
	 * Removes the listener if it is the currently active publisher, and retriggers
	 * another listener discovery phase
	 *
	 * @private
	 * @returns {Message}
	 */
	_removeListenerIfActive( pattern, socketWrapper ) {
		var subscriptionName, i, listenInProgress;
		for( var subscriptionName in this._providedRecords ) {
			var provider = this._providedRecords[ subscriptionName ];
			if(
				provider.socketWrapper === socketWrapper &&
				provider.pattern === pattern
			) {
				provider.socketWrapper.socket.removeListener( 'close', provider.closeListener );
				delete this._providedRecords[ subscriptionName ];
				this._sendHasProviderUpdate( false, subscriptionName );
				this._createListenMap( subscriptionName );
				this._triggerNextProvider( subscriptionName );
			}
		}
	}

	/**
	 * Sends a has provider update to all subscribers
	 *
	 * @private
	 * @returns {Message}
	 */
	_sendHasProviderUpdate( hasProvider, subscriptionName ) {
		if( this._topic !== C.TOPIC.RECORD ) {
			return
		}
		this._clientRegistry.sendToSubscribers( subscriptionName, this._createHasProviderMessage( hasProvider, this._topic, subscriptionName ) );
	}

	/**
	 * Create a has provider update message
	 *
	 * @private
	 * @returns {Message}
	 */
	_createHasProviderMessage(hasProvider, topic, subscriptionName) {
		return messageBuilder.getMsg(
				topic,
				C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
				[subscriptionName, (hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE)]
			);
	}

	/**
	 * Create a map of all the listeners that patterns match the subscriptionName
	 *
	 * @private
	 * @returns {void}
	 */
	_createListenMap( subscriptionName ) {
		const providers = [];
		for( var pattern in this._patterns ) {
			if( this._patterns[ pattern ].test( subscriptionName ) ) {
				var providersForPattern = this._providerRegistry.getSubscribers( pattern );
				for( var i = 0; i < providersForPattern.length; i++ ) {
					providers.push( {
						pattern: pattern,
						socketWrapper: providersForPattern[ i ]
					});
				}
			}
		}
		this._listenInProgress[ subscriptionName ] = providers;
	}

	/**
	 * Trigger the next provider in the map of providers capable of publishing
	 * data to the specific subscriptionName
	 *
	 * @private
	 * @returns {void}
	 */
	_triggerNextProvider( subscriptionName ) {
		if( !this._listenInProgress[ subscriptionName ] ) {
			return;
		}

		//TODO: Needs tests
		if( this._listenInProgress[ subscriptionName ].length === 0 ) {
			delete this._listenInProgress[ subscriptionName ];
			return;
		}

		const provider = this._listenInProgress[ subscriptionName ].shift();
		this._listenerTimeoutRegistery.addTimeout( subscriptionName, provider, this._triggerNextProvider.bind( this ) );
		provider.socketWrapper.send( messageBuilder.getMsg(
			this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ provider.pattern, subscriptionName ]
			)
		);
	}

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
	_getPattern( socketWrapper, message ) {
		if( message.data.length > 2  ) {
			this._onMsgDataError( socketWrapper, message.raw );
			return null;
		}

		var pattern = message.data[ 0 ];

		if( typeof pattern !== 'string' ) {
			this._onMsgDataError( socketWrapper, pattern );
			return null;
		}

		return pattern;
	}

	/**
	 * Validates that the pattern is not empty and is a valid regular expression
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {String} pattern
	 *
	 * @private
	 * @returns {RegExp}
	 */
	_validatePattern( socketWrapper, pattern ) {
		if( !pattern ) {
			return;
		}

		try{
			return new RegExp( pattern );
		} catch( e ) {
			this._onMsgDataError( socketWrapper, e.toString() );
			return;
		}
	}

	/**
	 * Processes errors for invalid messages
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {String} errorMsg
	 * @param   {Event} [errorEvent] Default to C.EVENT.INVALID_MESSAGE_DATA
	 *
	 * @private
	 * @returns {void}
	 */
	_onMsgDataError( socketWrapper, errorMsg, errorEvent ) {
		errorEvent = errorEvent || C.EVENT.INVALID_MESSAGE_DATA;
		socketWrapper.sendError( this._topic, errorEvent, errorMsg );
		this._options.logger.log( C.LOG_LEVEL.ERROR, errorEvent, errorMsg );
	}

	/**
	 * Clean-up for pattern subscriptions. If a connection is lost or a listener removes
	 * this makes sure that the internal pattern array stays in sync with the subscription
	 * registry
	 *
	 * @private
	 * @returns {void}
	 */
	_reconcilePatterns() {
		for( var pattern in this._patterns ) {
			if( !this._providerRegistry.hasSubscribers( pattern ) ) {
				delete this._patterns[ pattern ];
			}
		}
	}
}


module.exports = ListenerRegistry;
