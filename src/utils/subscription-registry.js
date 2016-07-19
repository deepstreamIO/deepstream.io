var C = require( '../constants/constants' );

/**
 * A generic mechanism to handle subscriptions from sockets to topics.
 * A bit like an event-hub, only that it registers SocketWrappers rather
 * than functions
 *
 * @constructor
 *
 * @param {Object} options deepstream options
 * @param {String} topic one of C.TOPIC
 * @param {[SubscriptionListener]} subscriptionListener Optional. A class exposing a onSubscriptionMade
 *                                                      and onSubscriptionRemoved method.
 */
var SubscriptionRegistry = function( options, topic, subscriptionListener ) {
	this._subscriptions = {};
	this._options = options;
	this._topic = topic;
	this._subscriptionListener = subscriptionListener;
	this._unsubscribeAllFunctions = [];
	this._constants = {
		MULTIPLE_SUBSCRIPTIONS: C.EVENT.MULTIPLE_SUBSCRIPTIONS,
		SUBSCRIBE: C.ACTIONS.SUBSCRIBE,
		UNSUBSCRIBE: C.ACTIONS.UNSUBSCRIBE,
		NOT_SUBSCRIBED: C.EVENT.NOT_SUBSCRIBED
	};
};

/**
* This method allows you to customise the SubscriptionRegistry so that it can send custom events and ack messages back.
* For example, when using the C.ACTIONS.LISTEN, you would override SUBSCRIBE with C.ACTIONS.SUBSCRIBE and UNSUBSCRIBE with UNSUBSCRIBE
*
* @param {string} name The name of the the variable to override. This can be either MULTIPLE_SUBSCRIPTIONS, SUBSCRIBE, UNSUBSCRIBE, NOT_SUBSCRIBED
* @param {string} value The value to override with.
*/
SubscriptionRegistry.prototype.setAction = function( name, value ) {
	this._constants[ name.toUpperCase() ] = value;
};

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
SubscriptionRegistry.prototype.sendToSubscribers = function( name, msgString, sender ) {
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
};

/**
 * Adds a SocketWrapper as a subscriber to a topic
 *
 * @param   {String} name
 * @param   {SocketWrapper} socketWrapper
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.subscribe = function( name, socketWrapper ) {
	if( this._subscriptions[ name ] === undefined ) {
		this._subscriptions[ name ] = [];
		if( this._subscriptionListener ) {
			this._subscriptionListener.onSubscriptionMade( name, socketWrapper );
		}
	}

	if( this._subscriptions[ name ].indexOf( socketWrapper ) !== -1 ) {
		var msg = 'repeat supscription to "' + name + '" by ' + socketWrapper.user;
		this._options.logger.log( C.LOG_LEVEL.WARN, this._constants.MULTIPLE_SUBSCRIPTIONS, msg );
		socketWrapper.sendError( this._topic, this._constants.MULTIPLE_SUBSCRIPTIONS, name );
		return;
	}

	if( !this.isSubscriber( socketWrapper ) ) {
		var unsubscribeAllFn = this.unsubscribeAll.bind( this, socketWrapper );
		this._unsubscribeAllFunctions.push({
			socketWrapper: socketWrapper,
			fn: unsubscribeAllFn
		});
		socketWrapper.socket.once( 'close', unsubscribeAllFn );
	}

	this._subscriptions[ name ].push( socketWrapper );
	var logMsg = 'for ' + this._topic + ':' + name + ' by ' + socketWrapper.user;
	this._options.logger.log( C.LOG_LEVEL.DEBUG, this._constants.SUBSCRIBE, logMsg );
	socketWrapper.sendMessage( this._topic, C.ACTIONS.ACK, [ this._constants.SUBSCRIBE, name ] );
};

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
SubscriptionRegistry.prototype.unsubscribe = function( name, socketWrapper, silent ) {
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
		delete this._subscriptions[ name ];

		if( this._subscriptionListener ) {
			this._subscriptionListener.onSubscriptionRemoved( name, socketWrapper );
		}
	} else {
		this._subscriptions[ name ].splice( this._subscriptions[ name ].indexOf( socketWrapper ), 1 );
	}

	if( !silent ) {
		var logMsg = 'for ' + this._topic + ':' + name + ' by ' + socketWrapper.user;
		this._options.logger.log( C.LOG_LEVEL.DEBUG, this._constants.UNSUBSCRIBE, logMsg );
		socketWrapper.sendMessage( this._topic, C.ACTIONS.ACK, [ this._constants.UNSUBSCRIBE, name ] );
	}
};

/**
 * Removes the SocketWrapper from all subscriptions. This is also called
 * when the socket closes
 *
 * @param   {SocketWrapper} socketWrapper
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.unsubscribeAll = function( socketWrapper ) {
	var name,
		index;

	for( name in this._subscriptions ) {
		index = this._subscriptions[ name ].indexOf( socketWrapper );

		if( index !== -1 ) {
			this.unsubscribe( name, socketWrapper );
		}
	}
};

/**
 * Returns true if socketWrapper is subscribed to any of the events in
 * this registry. This is useful to bind events on close only once
 *
 * @param {SocketWrapper} socketWrapper
 *
 * @public
 * @returns {Boolean} isSubscriber
 */
SubscriptionRegistry.prototype.isSubscriber = function( socketWrapper ) {
	for( var name in this._subscriptions ) {
		if( this._subscriptions[ name ].indexOf( socketWrapper ) !== -1 ) {
			return true;
		}
	}

	return false;
};

/**
 * Returns an array of SocketWrappers that are subscribed
 * to <name> or null if there are no subscribers
 *
 * @param   {String} name
 *
 * @public
 * @returns {Array} SocketWrapper[]
 */
SubscriptionRegistry.prototype.getSubscribers = function( name ) {
	if( this.hasSubscribers( name ) ) {
		return this._subscriptions[ name ].slice();
	} else {
		return null;
	}
};

/**
 * Returns a random SocketWrapper out of the array
 * of SocketWrappers that are subscribed to <name>
 *
 * @param   {String} name
 *
 * @public
 * @returns {SocketWrapper}
 */
SubscriptionRegistry.prototype.getRandomSubscriber = function( name ) {
	var subscribers = this.getSubscribers( name );

	if( subscribers ) {
		return subscribers[ Math.floor( Math.random() * subscribers.length ) ];
	} else {
		return null;
	}
};

/**
 * Returns true if there are SocketWrappers that
 * are subscribed to <name> or false if there
 * aren't any subscribers
 *
 * @param   {String}  name
 *
 * @public
 * @returns {Boolean} hasSubscribers
 */
SubscriptionRegistry.prototype.hasSubscribers = function( name ) {
	return !!this._subscriptions[ name ] && this._subscriptions[ name ].length !== 0;
};

/**
 * Returns a list of all the topic this registry
 * currently has subscribers for
 *
 * @public
 * @returns {Array} names
 */
SubscriptionRegistry.prototype.getNames = function() {
	return Object.keys( this._subscriptions );
};

/**
 * Allows to set a subscriptionListener after the class had been instantiated
 *
 * @param {SubscriptionListener} subscriptionListener - a class exposing a onSubscriptionMade and onSubscriptionRemoved method
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.setSubscriptionListener = function( subscriptionListener ) {
	this._subscriptionListener = subscriptionListener;
};

module.exports = SubscriptionRegistry;