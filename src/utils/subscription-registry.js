'use strict';

const C = require( '../constants/constants' );
const DistributedStateRegistry = require( '../cluster/distributed-state-registry' );

class SubscriptionRegistry {

	/**
	 * A generic mechanism to handle subscriptions from sockets to topics.
	 * A bit like an event-hub, only that it registers SocketWrappers rather
	 * than functions
	 *
	 * @constructor
	 *
	 * @param {Object} options deepstream options
	 * @param {String} topic one of C.TOPIC
	 * @param {[String]} clusterTopic A unique cluster topic, if not created uses format: topic_SUBSCRIPTIONS
	 */
	constructor( options, topic, clusterTopic ) {
		this._subscriptions = {}
		this._options = options;
		this._topic = topic;
		this._subscriptionListener = null;
		this._unsubscribeAllFunctions = [];
		this._constants = {
			MULTIPLE_SUBSCRIPTIONS: C.EVENT.MULTIPLE_SUBSCRIPTIONS,
			SUBSCRIBE: C.ACTIONS.SUBSCRIBE,
			UNSUBSCRIBE: C.ACTIONS.UNSUBSCRIBE,
			NOT_SUBSCRIBED: C.EVENT.NOT_SUBSCRIBED
		}

		this._clusterSubscriptions = new DistributedStateRegistry( clusterTopic || `${topic}_${C.TOPIC.SUBSCRIPTIONS}`, options );
		this._clusterSubscriptions.on( 'add', this._onClusterSubscriptionAdded.bind( this ) );
		this._clusterSubscriptions.on( 'remove', this._onClusterSubscriptionRemoved.bind( this ) );
	}

	/**
	 * Return all the servers that have this subscription.
	 *
	 * @param  {String} subscriptionName the subscriptionName to look for
	 *
	 * @public
	 * @return {Array}  An array of all the servernames with this subscription
	 */
	getAllServers( subscriptionName ) {
		return this._clusterSubscriptions.getAllServers( subscriptionName );
	}

	/**
	 * Return all the servers that have this subscription excluding the current
	 * server name
	 *
	 * @param  {String} subscriptionName the subscriptionName to look for
	 *
	 * @public
	 * @return {Array}  An array of all the servernames with this subscription
	 */
	getAllRemoteServers( subscriptionName ) {
		const serverNames = this._clusterSubscriptions.getAllServers( subscriptionName );
		const localServerIndex = serverNames.indexOf( this._options.serverName );
		if (  localServerIndex > -1 ) {
			serverNames.splice( serverNames.indexOf( this._options.serverName ), 1 );
		}
		return serverNames;
	}

	/**
	 * Returns a list of all the topic this registry
	 * currently has subscribers for
	 *
	 * @public
	 * @returns {Array} names
	 */
	getNames() {
		return this._clusterSubscriptions.getAll();
	}

	/**
	 * Returns true if the subscription exists somewhere
	 * in the cluster
	 *
	 * @public
	 * @returns {Array} names
	 */
	hasName( subscriptionName ) {
		return this._clusterSubscriptions.getAll().indexOf( subscriptionName ) !== -1;
	}

	/**
	* This method allows you to customise the SubscriptionRegistry so that it can send custom events and ack messages back.
	* For example, when using the C.ACTIONS.LISTEN, you would override SUBSCRIBE with C.ACTIONS.SUBSCRIBE and UNSUBSCRIBE with UNSUBSCRIBE
	*
	* @param {string} name The name of the the variable to override. This can be either MULTIPLE_SUBSCRIPTIONS, SUBSCRIBE, UNSUBSCRIBE, NOT_SUBSCRIBED
	* @param {string} value The value to override with.
	*
	* @public
	* @returns {void}
	*/
	setAction( name, value ) {
		this._constants[ name.toUpperCase() ] = value;
	}

	/**
	 * Sends a message string to all subscribers
	 *
	 * @param   {String} name      the name/topic the subscriber was previously registered for
	 * @param   {String} msgString the message as string
	 * @param   {[SocketWrapper]} sender an optional socketWrapper that shouldn't receive the message
	 *
	 * @public
	 * @returns {void}
	 */
	sendToSubscribers( name, msgString, sender ) {
		if( this._subscriptions[ name ] === undefined ) {
			return;
		}

		var i, l = this._subscriptions[ name ].length;

		for( i = 0; i < l; i++ ) {
			if( this._subscriptions[ name ] &&
				this._subscriptions[ name ][ i ] &&
				this._subscriptions[ name ][ i ] !== sender
			) {
				this._subscriptions[ name ][ i ].send( msgString );
			}
		}
	}

	/**
	 * Adds a SocketWrapper as a subscriber to a topic
	 *
	 * @param   {String} name
	 * @param   {SocketWrapper} socketWrapper
	 *
	 * @public
	 * @returns {void}
	 */
	subscribe( name, socketWrapper ) {
		if( this._subscriptions[ name ] === undefined ) {
			this._subscriptions[ name ] = [];
		}

		if( this._subscriptions[ name ].indexOf( socketWrapper ) !== -1 ) {
			var msg = 'repeat supscription to "' + name + '" by ' + socketWrapper.user;
			this._options.logger.log( C.LOG_LEVEL.WARN, this._constants.MULTIPLE_SUBSCRIPTIONS, msg );
			socketWrapper.sendError( this._topic, this._constants.MULTIPLE_SUBSCRIPTIONS, name );
			return;
		}

		if( !this.isLocalSubscriber( socketWrapper ) ) {
			var unsubscribeAllFn = this.unsubscribeAll.bind( this, socketWrapper );
			this._unsubscribeAllFunctions.push({
				socketWrapper: socketWrapper,
				fn: unsubscribeAllFn
			});
			socketWrapper.socket.once( 'close', unsubscribeAllFn );
		}

		this._subscriptions[ name ].push( socketWrapper );

		if( this._subscriptionListener ) {
			this._subscriptionListener.onSubscriptionMade(
				name,
				socketWrapper,
				this._subscriptions[ name ].length
			);
		}

		this._clusterSubscriptions.add( name );

		var logMsg = 'for ' + this._topic + ':' + name + ' by ' + socketWrapper.user;
		this._options.logger.log( C.LOG_LEVEL.DEBUG, this._constants.SUBSCRIBE, logMsg );
		socketWrapper.sendMessage( this._topic, C.ACTIONS.ACK, [ this._constants.SUBSCRIBE, name ] );
	}

	/**
	 * Removes a SocketWrapper from the list of subscriptions for a topic
	 *
	 * @param   {String} name
	 * @param   {SocketWrapper} socketWrapper
	 * @param 	{Boolean} silent supresses logs and unsubscribe ACK messages
	 *
	 * @public
	 * @returns {void}
	 */
	unsubscribe( name, socketWrapper, silent ) {
		var msg, i;

		for( i = 0; i < this._unsubscribeAllFunctions.length; i++ ) {
			if( this._unsubscribeAllFunctions[ i ].socketWrapper === socketWrapper ) {
				socketWrapper.socket.removeListener( 'close', this._unsubscribeAllFunctions[ i ].fn );
				this._unsubscribeAllFunctions.splice( i, 1 );
				break;
			}
		}

		if( this._subscriptions[ name ] === undefined ||
			this._subscriptions[ name ].indexOf( socketWrapper ) === -1 ) {
			msg = socketWrapper.user + ' is not subscribed to ' + name;
			this._options.logger.log( C.LOG_LEVEL.WARN, this._constants.NOT_SUBSCRIBED, msg );
			socketWrapper.sendError( this._topic, this._constants.NOT_SUBSCRIBED, name );
			return;
		}

		if( this._subscriptions[ name ].length === 1 ) {
			this._clusterSubscriptions.remove( name );
			delete this._subscriptions[ name ];
		} else {
			this._subscriptions[ name ].splice( this._subscriptions[ name ].indexOf( socketWrapper ), 1 );
		}

		if( this._subscriptionListener ) {
			const allServerNames = this._clusterSubscriptions.getAllServers( name );
			const indexOfCurrentNode = allServerNames.indexOf( this._options.serverName );
			if(  indexOfCurrentNode > -1 ) {
				allServerNames.splice( indexOfCurrentNode, 1 );
			}
			this._subscriptionListener.onSubscriptionRemoved(
				name,
				socketWrapper,
				this._subscriptions[ name ] ? this._subscriptions[ name ].length : 0,
				allServerNames.length
			);
		}

		if( !silent ) {
			var logMsg = 'for ' + this._topic + ':' + name + ' by ' + socketWrapper.user;
			this._options.logger.log( C.LOG_LEVEL.DEBUG, this._constants.UNSUBSCRIBE, logMsg );
			socketWrapper.sendMessage( this._topic, C.ACTIONS.ACK, [ this._constants.UNSUBSCRIBE, name ] );
		}
	}

	/**
	 * Removes the SocketWrapper from all subscriptions. This is also called
	 * when the socket closes
	 *
	 * @param   {SocketWrapper} socketWrapper
	 *
	 * @public
	 * @returns {void}
	 */
	unsubscribeAll( socketWrapper ) {
		var name,
			index;

		for( name in this._subscriptions ) {
			index = this._subscriptions[ name ].indexOf( socketWrapper );

			if( index !== -1 ) {
				this.unsubscribe( name, socketWrapper );
			}
		}
	}

	/**
	 * Returns true if socketWrapper is subscribed to any of the events in
	 * this registry. This is useful to bind events on close only once
	 *
	 * @param {SocketWrapper} socketWrapper
	 *
	 * @public
	 * @returns {Boolean} isLocalSubscriber
	 */
	isLocalSubscriber( socketWrapper ) {
		for( var name in this._subscriptions ) {
			if( this._subscriptions[ name ].indexOf( socketWrapper ) !== -1 ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Returns the amount of local subscribers to a specific subscription
	 *
	 * @param   {String} name
	 *
	 * @public
	 * @returns {Number}
	 */
	getLocalSubscribersCount( name ) {
		const subscriptions = this._subscriptions[ name ];
		if( subscriptions ) {
			return subscriptions.length;
		} else {
			return 0;
		}
	}

	/**
	 * Returns an array of SocketWrappers that are subscribed
	 * to <name> or null if there are no subscribers
	 *
	 * @param   {String} name
	 *
	 * @public
	 * @returns {Array} SocketWrapper[]
	 */
	getLocalSubscribers( name ) {
		if( this.hasLocalSubscribers( name ) ) {
			return this._subscriptions[ name ].slice();
		} else {
			return null;
		}
	}

	/**
	 * Returns a random SocketWrapper out of the array
	 * of SocketWrappers that are subscribed to <name>
	 *
	 * @param   {String} name
	 *
	 * @public
	 * @returns {SocketWrapper}
	 */
	getRandomLocalSubscriber( name ) {
		var subscribers = this.getLocalSubscribers( name );

		if( subscribers ) {
			return subscribers[ Math.floor( Math.random() * subscribers.length ) ];
		} else {
			return null;
		}
	}

	/**
	 * Returns true if there are SocketWrappers that
	 * are subscribed to <name> or false if there
	 * aren't any subscribers
	 *
	 * @param   {String}  name
	 *
	 * @public
	 * @returns {Boolean} hasLocalSubscribers
	 */
	hasLocalSubscribers( name ) {
		const subscriptions = this._subscriptions[ name ];
		return !!subscriptions && subscriptions.length !== 0;
	}

	/**
	 * Allows to set a subscriptionListener after the class had been instantiated
	 *
	 * @param {SubscriptionListener} subscriptionListener - a class exposing a onSubscriptionMade and onSubscriptionRemoved method
	 *
	 * @public
	 * @returns {void}
	 */
	setSubscriptionListener( subscriptionListener ) {
		this._subscriptionListener = subscriptionListener;
	}

	/**
	 * Called when a subscription has been added to the cluster
	 * This can be invoked locally or remotely, so we check if it
	 * is a local invocation and ignore it if so in favour of the
	 * call done from subscribe
	 * @param  {String} name the name that was added
	 */
	_onClusterSubscriptionAdded( name ) {
		if( this._subscriptionListener && !this._subscriptions[ name ] ) {
			this._subscriptionListener.onSubscriptionMade( name, null, 1 );
		}
	}

	/**
	 * Called when a subscription has been removed from the cluster
	 * This can be invoked locally or remotely, so we check if it
	 * is a local invocation and ignore it if so in favour of the
	 * call done from unsubscribe
	 * @param  {String} name the name that was removed
	 */
	_onClusterSubscriptionRemoved( name ) {
		if( this._subscriptionListener && !this._subscriptions[ name ] ) {
			this._subscriptionListener.onSubscriptionRemoved( name, null, 0, 0 );
		}
	}

}

module.exports = SubscriptionRegistry;
