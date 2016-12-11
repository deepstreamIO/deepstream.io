'use strict';

var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	DistributedStateRegistry = require( '../cluster/distributed-state-registry' ),
	TimeoutRegistry = require( './listener-timeout-registry' ),
	ListenerUtils = require( './listener-utils' );

module.exports = class ListenerRegistry {

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

		this._leadListen = {};
		this._leadingListen = {};
		this._options.messageConnector.subscribe( this._listenerUtils.getMessageBusTopic( this._options.serverName, this._topic ), this._onIncomingMessage.bind( this ) );
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
	 *
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
			return;
		}

		if (message.action === C.ACTIONS.UNLISTEN ) {
			this._providerRegistry.unsubscribe( pattern, socketWrapper );
			this._removeListener( socketWrapper, message );
			return;
		}

		if( this._listenerTimeoutRegistery.isALateResponder( socketWrapper, message ) ) {
			this._listenerTimeoutRegistery.handle( socketWrapper, message );
			return;
		}

		if( this._localListenInProgress[ subscriptionName ] ) {
			this._processResponseForListenInProgress( socketWrapper, subscriptionName, message );
			return;
		}

		this._listenerUtils.onMsgDataError( socketWrapper, message.raw, C.EVENT.INVALID_MESSAGE );
	}

	/**
	 * Handle messages that arrive via the message bus
	 *
	 * This can either be messages by the leader indicating that this
	 * node is responsible for starting a local discovery phase
	 * or from a resulting node with an ACK to allow the leader
	 * to move on and release its lock
	 *
	 * @param  {Object} message The received message
	 *
	 * @private
	 * @returns {void}
	 */
	_onIncomingMessage( message ) {
		if( this._options.serverName !== message.data[ 0 ] ) {
			return;
		}

		if( message.action === C.ACTIONS.LISTEN ) {
			this._leadListen[ message.data[ 1 ] ] = message.data[ 2 ];
			this._startLocalDiscoveryStage( message.data[ 1 ] );
			return;
		}

		if( message.action === C.ACTIONS.ACK ) {
			this._nextDiscoveryStage( message.data[ 1 ] );
			return;
		}

		if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
			this.onSubscriptionRemoved(
				message.data[ 1 ],
				null,
				this._clientRegistry.getLocalSubscribersCount( message.data[ 1 ] ),
				this._clientRegistry.getAllServers( message.data[ 1 ] ).length - 1
			);
			return;
		}
	}

	/**
	 * Process an accept or reject for a listen that is currently in progress
	 * and hasn't timed out yet.
	 *
	 * @param   {SocketWrapper} socketWrapper   The socket endpoint of the listener
	 * @param   {String} subscriptionName 		The name of the subscription that a listen is in process for
	 * @param   {Object} message          		Deepstream message object
	 *
	 * @private
	 * @returns {void}
	 */
	_processResponseForListenInProgress( socketWrapper, subscriptionName, message ) {
		if ( message.action === C.ACTIONS.LISTEN_ACCEPT ) {
			this._accept( socketWrapper, message );
			this._listenerTimeoutRegistery.rejectLateResponderThatAccepted( subscriptionName );
			this._listenerTimeoutRegistery.clear( subscriptionName );
			return;
		}

		if ( message.action === C.ACTIONS.LISTEN_REJECT ) {
			const provider = this._listenerTimeoutRegistery.getLateResponderThatAccepted( subscriptionName );
			if( provider ) {
				this._accept( provider.socketWrapper, message );
				this._listenerTimeoutRegistery.clear( subscriptionName );
			} else {
				this._triggerNextProvider( subscriptionName );
			}
			return;
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
	onSubscriptionMade( subscriptionName, socketWrapper, localCount ) {
		if( this.hasActiveProvider( subscriptionName ) ) {
			this._listenerUtils.sendHasProviderUpdateToSingleSubscriber( true, socketWrapper, subscriptionName );
			return;
		}

		if( localCount > 1 ) {
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
	onSubscriptionRemoved( subscriptionName, socketWrapper, localCount, remoteCount ) {
		const provider = this._locallyProvidedRecords[ subscriptionName ];

		if( this.hasActiveProvider( subscriptionName ) && !provider ) {
			const serverName = this._clusterProvidedRecords.getAllServers( subscriptionName )[ 0 ];
			this._listenerUtils.sendLastSubscriberRemoved( serverName, subscriptionName );
			return;
		}

		if( !provider ) {
			return;
		}

		if( localCount > 1 || remoteCount > 0 ) {
			return;
		}

		// provider discarded, but there is still another active subscriber
		if( localCount === 1 && provider.socketWrapper === socketWrapper) {
			return;
		}

		// provider isn't a subscriber, meaning we should wait for 0
		const subscribers = this._clientRegistry.getLocalSubscribers( subscriptionName );
		if( localCount === 1 && subscribers.indexOf( provider.socketWrapper ) === -1 ) {
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

		const provider = {
			socketWrapper: socketWrapper,
			pattern: message.data[ 0 ],
			closeListener: this._removeListener.bind( this, socketWrapper, message )
		};
		socketWrapper.once( 'close', provider.closeListener );

		this._locallyProvidedRecords[ subscriptionName ] = provider
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
		for( const subscriptionName of this._clientRegistry.getNames() ) {
			if( !subscriptionName.match( regExp ) ) {
				return;
			}

			const listenInProgress = this._localListenInProgress[ subscriptionName ];
			if( this._locallyProvidedRecords[ subscriptionName ] ) {
				continue;
			}

			if( listenInProgress ) {
				listenInProgress.push( {
					socketWrapper: socketWrapper,
					pattern: pattern
				} );
				continue;
			}

			this._startDiscoveryStage( subscriptionName )
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
		for( const subscriptionName in this._locallyProvidedRecords ) {
			const provider = this._locallyProvidedRecords[ subscriptionName ];
			if( provider.socketWrapper !== socketWrapper || provider.pattern !== pattern ) {
				continue;
			}

			provider.socketWrapper.removeListener( 'close', provider.closeListener );
			this._removeActiveListener( subscriptionName );

			if( this._clientRegistry.hasLocalSubscribers( subscriptionName ) ) {
				this._startDiscoveryStage( subscriptionName );
			}
		}
	}

	/**
	 * @private
	 * @returns {Void}
	*/
	_removeActiveListener( subscriptionName, provider ) {
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
		const localListenArray = this._listenerUtils.createLocalListenArray( this._patterns, this._providerRegistry, subscriptionName );

		if( localListenArray.length === 0  ) {
			return;
		}

		this._uniqueStateProvider.get( this._listenerUtils.getUniqueLockName( subscriptionName ), ( success ) => {
			if ( !success ) {
				return;
			}

			if( this.hasActiveProvider( subscriptionName ) ) {
				this._uniqueStateProvider.release(  this._listenerUtils.getUniqueLockName( subscriptionName ) );
				return;
			}

			this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.LEADING_LISTEN, `started for ${this._topic}:${subscriptionName}` );

			const remoteListenArray = this._listenerUtils.createRemoteListenArray( this._patterns, this._providerRegistry, subscriptionName );
			this._leadingListen[ subscriptionName ] = remoteListenArray;

			this._startLocalDiscoveryStage( subscriptionName, localListenArray );
		} );
	}

	/**
	 * called when a subscription has been provided to clear down the discovery stage, or when an ack has
	 * been recieved via the message bus
	 *
	 * @param  {String} subscriptionName check if the subscription has a provider yet, if not trigger
	 *                                   the next request via the message bus
	 *
	 * @private
	 * @returns {void}
	 */
	_nextDiscoveryStage( subscriptionName ) {
		if( this.hasActiveProvider( subscriptionName ) || this._leadingListen[ subscriptionName ].length === 0 ) {
			this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.LEADING_LISTEN, `finished for ${this._topic}:${subscriptionName}` );
			delete this._leadingListen[ subscriptionName ];
			this._uniqueStateProvider.release(  this._listenerUtils.getUniqueLockName( subscriptionName ) );
		} else {
			const nextServerName = this._leadingListen[ subscriptionName ].shift();
			this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.LEADING_LISTEN, `started for ${this._topic}:${subscriptionName}` );
			this._listenerUtils.sendRemoteDiscoveryStart( nextServerName, subscriptionName );
		}
	}

	/**
	 * Start discovery phase once a lock is obtained from the leader within
	 * the cluster
	 *
	 * @param   {String} subscriptionName the subscription name
	 * @param	{Object} [localListenMap] map of all listeners
	 *
	 * @private
	 * @returns {void}
	 */
	_startLocalDiscoveryStage( subscriptionName, localListenArray ) {

		if( !localListenArray ) {
			localListenArray = this._listenerUtils.createLocalListenArray( this._patterns, this._providerRegistry, subscriptionName );
		}

		if( localListenArray.length > 0 ) {
			this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.LOCAL_LISTEN, `started for ${this._topic}:${subscriptionName}` );
			this._localListenInProgress[ subscriptionName ] = localListenArray;
			this._triggerNextProvider( subscriptionName );
		}
	}

	/**
	 * Finalises a local listener discovery stage
	 *
	 * @param   {String} subscriptionName the subscription a listener is searched for
	 *
	 * @private
	 * @returns {void}
	 */
	_stopLocalDiscoveryStage( subscriptionName ) {
		delete this._localListenInProgress[ subscriptionName ];

		this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.LOCAL_LISTEN, `stopped for ${this._topic}:${subscriptionName}` );

		if( this._leadingListen[ subscriptionName ] ) {
			this._nextDiscoveryStage( subscriptionName );
		} else {
			this._listenerUtils.sendRemoteDiscoveryStop( this._leadListen[ subscriptionName ], subscriptionName );
			delete this._leadListen[ subscriptionName ];
		}
	}

	/**
	 * Trigger the next provider in the map of providers capable of publishing
	 * data to the specific subscriptionName
	 *
	 * @param   {String} subscriptionName the subscription a listener is searched for
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
		const subscribers = this._clientRegistry.getLocalSubscribers( subscriptionName );
		if( subscribers && subscribers.indexOf( provider.socketWrapper ) !== -1 ) {
			this._triggerNextProvider( subscriptionName );
			return;
		}
		this._listenerTimeoutRegistery.addTimeout( subscriptionName, provider, this._triggerNextProvider.bind( this ) );
		this._listenerUtils.sendSubscriptionForPatternFound( provider, subscriptionName );
	}

	/**
	 * Triggered when a subscription is being provided by a node in the cluster
	 *
	 * @param   {String} subscriptionName the subscription a listener is searched for
	 *
	 * @private
	 * @returns {void}
	 */
	_onRecordStartProvided( subscriptionName ) {
		this._listenerUtils.sendHasProviderUpdate( true, subscriptionName );
		if( this._leadingListen[ subscriptionName ] ) {
			this._nextDiscoveryStage( subscriptionName );
		}
	}

	/**
	 * Triggered when a subscription is stopped being provided by a node in the cluster
	 *
	 * @param   {String} subscriptionName the subscription a listener is searched for
	 *
	 * @private
	 * @returns {void}
	 */
	_onRecordStopProvided( subscriptionName ) {
		this._listenerUtils.sendHasProviderUpdate( false, subscriptionName );
		if( !this.hasActiveProvider( subscriptionName ) && this._clientRegistry.hasName( subscriptionName ) ) {
			this._startDiscoveryStage( subscriptionName );
		}
	}

	/**
	 * Compiles a regular expression from an incoming pattern
	 *
	 * @param {String} pattern       the raw pattern
	 * @param {SocketWrapper} socketWrapper connection to the client that provided the pattern
	 * @param {Number} count         the amount of times this pattern is present
	 *
	 * @private
	 * @returns {void}
	 */
	_addPattern( pattern, socketWrapper, count ) {
		if( count === 1 ) {
			this._patterns[ pattern ] = new RegExp( pattern );
		}
	}

	/**
	 * Deletes the pattern regex when removed
	 *
	 * @param {String} pattern       the raw pattern
	 * @param {SocketWrapper} socketWrapper connection to the client that provided the pattern
	 * @param {Number} count         the amount of times this pattern is present
	 *
	 * @private
	 * @returns {void}
	 */
	_removePattern( pattern, socketWrapper, count ) {
		if( socketWrapper ) {
			this._listenerTimeoutRegistery.removeProvider( socketWrapper );
			this._listenerUtils.removeListenerFromInProgress( this._localListenInProgress, pattern, socketWrapper );
			this._removeListenerIfActive( pattern, socketWrapper );
		}

		if( count === 0 ) {
			delete this._patterns[ pattern ];
		}
	}
}
