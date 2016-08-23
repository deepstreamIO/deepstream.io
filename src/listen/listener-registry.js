'use strict';

var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	DistributedStateRegistry = require( '../utils/distributed-state-registry' ),
	TimeoutRegistry = require( './listener-timeout-registry' ),
	ListenerUtils = require( './listener-utils' ),
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

		this._uniqueStateProvider = this._options.uniqueRegistry;

		this._listenerUtils = new ListenerUtils( topic, options, clientRegistry );

		this._patterns = {};
		this._localListenInProgress = {};
		this._listenerTimeoutRegistery = new TimeoutRegistry( topic, options );

		this._providerRegistry = new SubscriptionRegistry( options, this._topic, `${topic}_${C.TOPIC.LISTEN_PATTERNS}` );
		this._providerRegistry.setAction( 'subscribe', C.ACTIONS.LISTEN );
		this._providerRegistry.setAction( 'unsubscribe', C.ACTIONS.UNLISTEN );
		this._providerRegistry.setSubscriptionListener( {
			onSubscriptionRemoved: this._removePattern.bind( this ),
			onSubscriptionMade: this._addPattern.bind( this )
		} );

		this._locallyProvidedRecords = {};
		this._clusterProvidedRecords = new DistributedStateRegistry( `${topic}_${C.TOPIC.PUBLISHED_SUBSCRIPTIONS}`, options );
		this._clusterProvidedRecords.on( 'add', this._onRecordStartProvided.bind( this ) );
		this._clusterProvidedRecords.on( 'remove', this._onRecordStopProvided.bind( this ) );

		this._leadingListen = {};
		this._listenTopic = this._listenerUtils.getMessageBusTopic( this._options.serverName, this._topic );
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
		if (message.action === C.ACTIONS.LISTEN ) {
			this._addListener( socketWrapper, message );
		} else if (message.action === C.ACTIONS.UNLISTEN ) {
			this._removeListener( socketWrapper, message );
		} else if( this._listenerTimeoutRegistery.isALateResponder( socketWrapper, message ) ) {
			this._listenerTimeoutRegistery.handle( socketWrapper, message );
		} else if( this._localListenInProgress[ subscriptionName ] ) {
			this._processResponseForListenInProgress( socketWrapper, subscriptionName, message );
		} else {
			this._listenerUtils.onMsgDataError( socketWrapper, message.raw, C.EVENT.INVALID_MESSAGE );
		}
	}

	/**
	 * Handle messages that arrive via the message bus
	 *
	 * This can either messages by the leader indicating that the
	 * node is responsible for starting a local discovery phase,
	 * or from a resulting node with an ack to allow the leader
	 * to move on release its lock
	 * @param  {Object} message The message recieved
	 * @return void
	 */
	_handleMessageBus( message ) {
		if( this._options.serverName === message.data[ 0 ] ) {
			if( message[ 1 ] === C.ACTIONS.LISTEN ) {
				this._startLocalDiscoveryStage( message.data[ 2 ] );
			} else if( message[ 1 ] === C.ACTIONS.ACK ) {
				this._nextDiscoveryStage( message.data[ 2 ] );
			}
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
			this._listenerUtils.sendHasProviderUpdateToSingleSubscriber( true, socketWrapper, subscriptionName );
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

		this._listenerUtils.sendSubscriptionForPatternRemoved( provider, subscriptionName );
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

		this._listenerTimeoutRegistery.clearTimeout( subscriptionName );

		this._locallyProvidedRecords[ subscriptionName ] = {
			socketWrapper: socketWrapper,
			pattern: message.data[ 0 ],
			closeListener: this._removeListener.bind( this, socketWrapper, message )
		}
		socketWrapper.socket.once( 'close', this._locallyProvidedRecords[ subscriptionName ].closeListener );
		this._clusterProvidedRecords.add( subscriptionName );

		this._stopLocalDiscoveryStage( subscriptionName );
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
		const pattern = this._listenerUtils.getPattern( socketWrapper, message );
		const regExp = this._listenerUtils.validatePattern( socketWrapper, pattern );

		if( !regExp ) {
			return;
		}

		const providers = this._providerRegistry.getLocalSubscribers( pattern );
		const notInSubscriptionRegistry = !providers || providers.indexOf( socketWrapper ) === -1;
		if( notInSubscriptionRegistry ) {
			this._providerRegistry.subscribe( pattern, socketWrapper );
		}

		this._reconcileSubscriptionsToPatterns( regExp, pattern, socketWrapper );
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
		const pattern = message.data[ 0 ] ;

		this._providerRegistry.unsubscribe( pattern, socketWrapper );
		this._listenerUtils.removeListenerFromInProgress( this._localListenInProgress, pattern, socketWrapper );
		this._removeListenerIfActive( pattern, socketWrapper );
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
		this._listenerUtils.sendHasProviderUpdate( false, subscriptionName );
		delete this._locallyProvidedRecords[ subscriptionName ];
		this._clusterProvidedRecords.remove( subscriptionName );
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
		const remoteListenArray = this._listenerUtils.createRemoteListenArray( this._patterns, this._providerRegistry, subscriptionName );
		this._uniqueStateProvider.get( this._listenerUtils.getUniqueLockName( subscriptionName ), ( success ) => {
			this._leadingListen[ subscriptionName ] = remoteListenArray;
			success && this._startLocalDiscoveryStage( subscriptionName );
		} );
	}

	/**
	 * called when a subscription has been provided to clear down the discovery stage, or when an ack has
	 * been recieved via the message bus
	 *
	 * @param  {String} subscriptionName check if the subscription has a provider yet, if not trigger
	 * the next request via the message mus
	 */
	_nextDiscoveryStage( subscriptionName ) {
		if( this.hasActiveProvider( subscriptionName ) || this._leadingListen[ subscriptionName ].length === 0 ) {
			delete this._leadingListen[ subscriptionName ];
			this._uniqueStateProvider.release(  this._listenerUtils.getUniqueLockName( subscriptionName ) );
		} else {
			const nextServerName = this._leadingListen[ subscriptionName ].splice( 0, 1 )[ 0 ];
			this._listenerUtils.sendRemoteDiscoveryStart( nextServerName, subscriptionName );
		}
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
		const localListenMap = this._listenerUtils.createLocalListenMap( this._patterns, this._providerRegistry, subscriptionName );

		if( localListenMap.length > 0 ) {
			this._localListenInProgress[ subscriptionName ] = localListenMap;
			if( this._localListenInProgress[ subscriptionName ] ) {
				this._triggerNextProvider( subscriptionName );
			}
		}
	}

	_stopLocalDiscoveryStage( subscriptionName ) {
		delete this._localListenInProgress[ subscriptionName ];

		if( this._leadingListen[ subscriptionName ] ) {
			this._nextDiscoveryStage( subscriptionName );
		} else {
			this._listenerUtils.sendRemoteDiscoveryStop( 'leaderserver', subscriptionName );
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
		const listenInProgress = this._localListenInProgress[ subscriptionName ];

		if( !listenInProgress ) {
			return;
		}

		if( listenInProgress.length === 0 ) {
			this._stopLocalDiscoveryStage( subscriptionName );
			return;
		}

		const provider = listenInProgress.shift();
		this._listenerTimeoutRegistery.addTimeout( subscriptionName, provider, this._triggerNextProvider.bind( this ) );
		this._listenerUtils.sendSubscriptionForPatternFound( provider, subscriptionName );
	}

	_onRecordStartProvided( subscriptionName ) {
		this._listenerUtils.sendHasProviderUpdate( true, subscriptionName );
		this._nextDiscoveryStage( subscriptionName );
	}

	_onRecordStopProvided( subscriptionName ) {
		this._listenerUtils.sendHasProviderUpdate( false, subscriptionName );
		if( this._clientRegistry.hasSubscribers( subscriptionName ) ) {
			this._startDiscoveryStage( subscriptionName );
		}
	}

	/**
	 * Compile the pattern regex when first provided
	 * @private
	 * @returns {void}
	 */
	_addPattern( pattern, socketWrapper, count ) {
		if( count === 1 ) {
			this._patterns[ pattern ] = new RegExp( pattern );
		}
	}

	/**
	 * Delete the pattern regex when removed
	 *
	 * @private
	 * @returns {void}
	 */
	_removePattern( pattern, socketWrapper, count ) {
		if( count > 0 ) {
			return;
		}
		delete this._patterns[ pattern ];
	}
}

module.exports = ListenerRegistry;
