var C = require( '../constants/constants' );

/**
 * The MessageDistributor routes valid and permissioned messages to
 * various, previously registered handlers, e.g. event-, rpc- or recordHandler
 *
 * @param {Object} options deepstream options
 */
var MessageDistributor = function( options ) {
	this._callbacks = {};
	this._options = options;
};

/**
 * Accepts a socketWrapper and a parsed message as input and distributes
 * it to its subscriber, based on the message's topic
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed and permissioned message
 *
 * @public
 * @returns {void}
 */
MessageDistributor.prototype.distribute = function( socketWrapper, message ) {
	if( this._callbacks[ message.topic ] === undefined ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_TOPIC, message.topic );
		socketWrapper.sendError( C.TOPIC.ERROR, C.EVENT.UNKNOWN_TOPIC, message.topic );
		return;
	}

	socketWrapper.emit( message.topic, message );

	if( message.isCompleted !== true ) {
		this._callbacks[ message.topic ]( socketWrapper, message );
	}
};

/**
 * Allows handlers (event, rpc, record) to register for topics. Subscribes them
 * to both messages passed to the distribute method as well as messages received
 * from the messageConnector
 *
 * @param   {String}   topic    One of C.TOPIC
 * @param   {Function} callback The method that should be called for every message
 *                              on the specified topic. Will be called with socketWrapper
 *                              and message
 *
 * @public
 * @returns {void}
 */
MessageDistributor.prototype.registerForTopic = function( topic, callback ) {
	if( this._callbacks[ topic ] !== undefined ) {
		throw new Error( 'Callback already registered for topic ' + topic );
	}

	this._callbacks[ topic ] = callback;
	this._options.messageConnector.subscribe( topic, this._onMessageConnectorMessage.bind( this, callback ) );
};

/**
 * Whenever a message from the messageConnector is received it is passed
 * to the relevant handler, but with SOURCE_MESSAGE_CONNECTOR instead of
 * a socketWrapper as sender
 *
 * @param   {Function} callback the handler callback
 * @param   {Object}   message  the already parsed and validated message
 *
 * @private
 * @returns {void}
 */
MessageDistributor.prototype._onMessageConnectorMessage = function( callback, message ) {
	callback( C.SOURCE_MESSAGE_CONNECTOR, message );
};

module.exports = MessageDistributor;
