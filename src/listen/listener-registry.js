'use strict';

var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	DistributedStateRegistry = require( '../utils/distributed-state-registry' ),
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

		this._uniqueLockName = `${topic}_LISTEN_LOCK`;
		this._uniqueStateProvider = this._options.uniqueRegistry;

		this._patterns = {};
		this._localListenInProgress = {};
		this._listenerTimeoutRegistery = new TimeoutRegistry( topic, options );
		this._reconcilePatternsBound = this._reconcilePatterns.bind( this );

		this._providerRegistry = new SubscriptionRegistry( options, this._topic, `${topic}_${C.TOPIC.LISTEN_PATTERNS}` );
		this._providerRegistry.setAction( 'subscribe', C.ACTIONS.LISTEN );
		this._providerRegistry.setAction( 'unsubscribe', C.ACTIONS.UNLISTEN );

		this._locallyProvidedRecords = {};
		this._clusterProvidedRecords = new DistributedStateRegistry( `${topic}_${C.TOPIC.PUBLISHED_SUBSCRIPTIONS}`, options );

		this._leadingListen = {};
		this._listenTopic = this._getMessageBusTopic( this._options.serverName, this._topic );
		this._options.messageConnector.subscribe( this._listenTopic, this._handleMessageBus.bind( this ) );
	}

	/**
	 * Used primarily for tests. Returns whether or not a provider exists for
	 * the specific subscriptionName
	 * @public
	 * @returns {boolean}
	 */
	hasActiveProvider( susbcriptionName ) {
		return this._clusterProvidedRecords.has( susbcriptionName );
	}

	/**
	 * The main entry point to the handle class.
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
			// removing this functionality since it is no longer applicable
		} else if (message.action === C.ACTIONS.LISTEN ) {
			this._addListener( socketWrapper, message );
		} else if (message.action === C.ACTIONS.UNLISTEN ) {
			this._removeListener( socketWrapper, message );
		} else if( this._listenerTimeoutRegistery.isALateResponder( socketWrapper, message ) ) {
			this._listenerTimeoutRegistery.handle( socketWrapper, message );
		} else if( this._localListenInProgress[ subscriptionName ] ) {
			this._processResponseForListenInProgress( socketWrapper, subscriptionName, message );
		} else {
			this._onMsgDataError( socketWrapper, message.raw, C.EVENT.INVALID_MESSAGE );
		}
	}

	_handleMessageBus( message ) {
		if( this._options.serverName !== message.data[ 0 ] ) {
			return;
		}

		if( message[ 1 ] = C.ACTIONS.LISTEN ) {
			this._startLocalDiscoveryStage( message.data[ 2 ] );
		}
	}

	/**
	* Process an accept or reject for a listen that is currently in progress
	* which hasn't timed out yet.
	*/
	_processResponseForListenInProgress( socketWrapper, subscriptionName, message ) {
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
	 * Called by the record subscription registry whenever the subscription count decrements.
	 * Part of the subscriptionListener interface.
	 *
	 * @param   {String} name
	 *
	 * @public
	 * @returns {void}
	 */
	onSubscriptionMade( subscriptionName, socketWrapper, count ) {
		if( this.hasActiveProvider( subscriptionName ) ) {
			if( socketWrapper && this._topic === C.TOPIC.RECORD ) {
				socketWrapper.send( messageBuilder.getMsg(
					this._topic, C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, [ subscriptionName, C.TYPES.TRUE ]
				) );
			}
			return;
		}

		if( count > 1 ) {
			return;
		}

		this._startDiscoveryStage( subscriptionName );
	}

	/**
	 * Called by the record subscription registry whenever the subscription count increments.
	 * Part of the subscriptionListener interface.
	 *
	 * @param   {String} subscriptionName
	 *
	 * @public
	 * @returns {void}
	 */
	onSubscriptionRemoved( subscriptionName, socketWrapper, count ) {
		const provider = this._locallyProvidedRecords[ subscriptionName ];

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
		if( count === 1 && this._clientRegistry.getLocalSubscribers().indexOf( provider.socketWrapper ) === -1 ) {
			return;
		}

		provider.socketWrapper.send(
			messageBuilder.getMsg(
				this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ provider.pattern, subscriptionName ]
			)
		);

		this._removeActiveListener( subscriptionName, provider );
	}

	/**
	 * Register callback for when the server recieves an Accept message from the client
	 *
	 * @private
	 * @returns {void}
	 */
	_accept( socketWrapper, message ) {
		const subscriptionName = message.data[ 1 ];

		this._stopLocalDiscoveryStage( subscriptionName );

		this._listenerTimeoutRegistery.clearTimeout( subscriptionName );

		this._locallyProvidedRecords[ subscriptionName ] = {
			socketWrapper: socketWrapper,
			pattern: message.data[ 0 ],
			closeListener: this._removeListener.bind( this, socketWrapper, message )
		}
		socketWrapper.socket.once( 'close', this._locallyProvidedRecords[ subscriptionName ].closeListener );
		this._clusterProvidedRecords.add( subscriptionName );
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

		const providers = this._providerRegistry.getLocalSubscribers( pattern );
		const notInSubscriptionRegistry = !providers || providers.indexOf( socketWrapper ) === -1;
		if( notInSubscriptionRegistry ) {
			this._providerRegistry.subscribe( pattern, socketWrapper );
			this._addUniqueCloseListener( socketWrapper, this._reconcilePatternsBound );
		}

		// Create pattern entry (if it doesn't exist already)
		if( !this._patterns[ pattern ] ) {
			this._patterns[ pattern ] = regExp;
		}

		this._reconcileSubscriptionsToPatterns( regExp, pattern, socketWrapper );
	}

	/**
	* Adds a unique close listener to avoid unnecessary adds
	*/
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
				const listenInProgress = this._localListenInProgress[ subscriptionName ];
				if( this._locallyProvidedRecords[ subscriptionName ] ) {
					continue;
				} else if( listenInProgress ) {
					listenInProgress.push( {
						socketWrapper: socketWrapper,
						pattern: pattern
					} );
				} else {
					this._startDiscoveryStage( subscriptionName )
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
		for( var subscriptionName in this._localListenInProgress ) {
			listenInProgress = this._localListenInProgress[ subscriptionName ];
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
		for( var subscriptionName in this._locallyProvidedRecords ) {
			var provider = this._locallyProvidedRecords[ subscriptionName ];
			if(
				provider.socketWrapper === socketWrapper &&
				provider.pattern === pattern
			) {
				provider.socketWrapper.socket.removeListener( 'close', provider.closeListener );
				this._removeActiveListener( subscriptionName );
				this._startDiscoveryStage( subscriptionName );
			}
		}
	}

	/**
	 * @private
	 * @returns {Void}
	*/
	_removeActiveListener( subscriptionName, provider ) {
		this._sendHasProviderUpdate( false, subscriptionName );
		delete this._locallyProvidedRecords[ subscriptionName ];
		this._clusterProvidedRecords.remove( subscriptionName );
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
	 * Start discovery phase once a lock is obtained from the leader within
	 * the cluster
	 *
	 * @param   {String} subscriptionName the subscription name
	 *
	 * @private
	 * @returns {void}
	 */
	_startDiscoveryStage( subscriptionName ) {
		this._uniqueStateProvider.get( `${this._uniqueLockName}_${subscriptionName}`, ( success ) => {
			// generate a map of all servers that can provide..
			success && this._startLocalDiscoveryStage( subscriptionName );
		} );
	}

	/**
	 * Start discovery phase once a lock is obtained from the leader within
	 * the cluster
	 *
	 * @param   {String} subscriptionName the subscription name
	 *
	 * @private
	 * @returns {void}
	 */
	_startLocalDiscoveryStage( subscriptionName ) {
		this._createListenMap( subscriptionName );
		if( this._localListenInProgress[ subscriptionName ] ) {
			this._triggerNextProvider( subscriptionName );
		}
	}

	_stopLocalDiscoveryStage( subscriptionName ) {
		delete this._localListenInProgress[ subscriptionName ];
		
		if( this._leadingListen[ subscriptionName ] ) {
			if( this.hasProvider( subscriptionName ) || this._leadingListen[ subscriptionName ].length === 0 ) {
				delete this._leadingListen[ subscriptionName ];
				this._uniqueStateProvider.remove( this._uniqueLockName );		
			} else {
				const nextServer = this._leadingListen[ subscriptionName ].splice( 0, 1 )[ 0 ];
				const messageTopic = this._getMessageBusTopic( nextServer, topic );
				this._options.messageConnector.publish( messageTopic, {
					topic: messageTopic,
					action: C.ACTIONS.LISTEN,
					data:[ serverName, subscriptionName ]
				});
			}
		}
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
				var providersForPattern = this._providerRegistry.getLocalSubscribers( pattern );
				for( var i = 0; providersForPattern && i < providersForPattern.length; i++ ) {
					providers.push( {
						pattern: pattern,
						socketWrapper: providersForPattern[ i ]
					});
				}
			}
		}
		if( providers.length > 0 ) {
			this._localListenInProgress[ subscriptionName ] = providers;
		}
	}

	/**
	 * Trigger the next provider in the map of providers capable of publishing
	 * data to the specific subscriptionName
	 *
	 * @private
	 * @returns {void}
	 */
	_triggerNextProvider( subscriptionName ) {
		if( !this._localListenInProgress[ subscriptionName ] ) {
			return;
		}

		//TODO: Needs tests
		if( this._localListenInProgress[ subscriptionName ].length === 0 ) {
			this._stopLocalDiscoveryStage( subscriptionName );
			return;
		}

		const provider = this._localListenInProgress[ subscriptionName ].shift();
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

	_getMessageBusTopic( serverName, topic ) {
		return C.TOPIC.LEADER_PRIVATE + serverName + topic + C.ACTIONS.LISTEN;
	}
}


module.exports = ListenerRegistry;
