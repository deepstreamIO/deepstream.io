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
 */
var SubscriptionRegistry = function( options, topic ) {
	this._subscriptions = {};
	this._options = options;
	this._topic = topic;
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

	for( var i = 0; i < this._subscriptions[ name ].length; i++ ) {
		if( this._subscriptions[ name ][ i ] !== sender ) {
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
	}

	if( this._subscriptions[ name ].indexOf( socketWrapper ) !== -1 ) {
		var msg = 'repeat supscription to "' + name + '" by ' + socketWrapper.user; 
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.MULTIPLE_SUBSCRIPTIONS, msg );
		socketWrapper.sendError( this._topic, C.EVENT.MULTIPLE_SUBSCRIPTIONS, name );
		return;
	}

	socketWrapper.socket.once( 'close', this.unsubscribeAll.bind( this, socketWrapper ) );
	this._subscriptions[ name ].push( socketWrapper );
	var logMsg = 'for ' + this._topic + ':' + name + ' by ' + socketWrapper.user;
	this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.SUBSCRIBE, logMsg );
	socketWrapper.sendMessage( this._topic, C.ACTIONS.ACK, [ C.ACTIONS.SUBSCRIBE, name ] );
};

/**
 * Removes a SocketWrapper from the list of subscriptions for a topic
 *
 * @param   {String} name          
 * @param   {SocketWrapper} socketWrapper
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.unsubscribe = function( name, socketWrapper ) {
	var msg;

	if( this._subscriptions[ name ] === undefined || 
		this._subscriptions[ name ].indexOf( socketWrapper ) === -1 ) {
		msg = socketWrapper.user + ' is not subscribed to ' + name;
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.NOT_SUBSCRIBED, msg );
		socketWrapper.sendError( this._topic, C.EVENT.NOT_SUBSCRIBED, name );
		return;
	}

	if( this._subscriptions[ name ].length === 1 ) {
		delete this._subscriptions[ name ];
	} else {
		this._subscriptions[ name ].splice( this._subscriptions[ name ].indexOf( socketWrapper ), 1 );
	}

	var logMsg = 'for ' + this._topic + ':' + name + ' by ' + socketWrapper.user;
	this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.UNSUBSCRIBE, logMsg );
	socketWrapper.sendMessage( this._topic, C.ACTIONS.ACK, [ C.ACTIONS.UNSUBSCRIBE, name ] );
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
			this._subscriptions[ name ].splice( index, 1 );
		}
	}
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
		return this._subscriptions[ name ];
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

module.exports = SubscriptionRegistry;