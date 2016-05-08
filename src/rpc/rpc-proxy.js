var C = require( '../constants/constants' ),
	events = require( 'events' ),
	utils = require( 'util' );

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky bugger.
 *
 * @param {Object} options
 * @param {String} receiverPrivateTopic
 * @param {String} rpcName
 * @param {String} correlationId
 *
 * @extends {EventEmitter}
 * @constructor
 */
var RpcProxy = function( options, receiverPrivateTopic, rpcName, correlationId ) {
	this._options = options;
	this._privateTopic = C.TOPIC.PRIVATE + this._options.serverName;
	this._receiverPrivateTopic = receiverPrivateTopic;
	this._rpcName = rpcName;
	this._correlationId = correlationId;
	this._processIncomingMessageFn = this._processIncomingMessage.bind( this );
	this._options.messageConnector.subscribe( this._privateTopic, this._processIncomingMessageFn );
};

utils.inherits( RpcProxy, events.EventEmitter );

/**
 * Returns the private topic of the remote
 * part of this proxy
 *
 * @public
 * @returns {String} remote private topic
 */
RpcProxy.prototype.getRemotePrivateTopic = function() {
	return this._receiverPrivateTopic;
};

/**
 * Unsubscribes the proxy from messageConnector messages
 *
 * @public
 * @returns {void}
 */
RpcProxy.prototype.destroy = function() {
	this._options.messageConnector.unsubscribe( this._privateTopic, this._processIncomingMessageFn );
};

/**
 * Mimicks the SocketWrapper's send method, but expects a message object,
 * instead of a string.
 *
 * Adds additional information to the message that enables the counterparty
 * to identify the sender
 *
 * @param   {Object} message
 *
 * @public
 * @returns {void}
 */
RpcProxy.prototype.send = function( message ) {
	message.remotePrivateTopic = this._privateTopic;
	message.topic = this._receiverPrivateTopic;
	message.originalTopic = C.TOPIC.RPC;
	this._options.messageConnector.publish( this._receiverPrivateTopic, message );
	message.isCompleted = true;
};

/**
 * Mimicks the SocketWrapper's sendError method.
 * Sends an error on the specified topic. The
 * action will automatically be set to C.ACTION.ERROR
 *
 * @param {String} topic one of C.TOPIC - ignored in this instance
 * @param {String} type one of C.EVENT
 * @param {String} msg generic error message
 *
 * @public
 * @returns {void}
 */
RpcProxy.prototype.sendError = function( topic, type, msg ) {
	var errorMsg = {
		topic: this._receiverPrivateTopic,
		originalTopic: C.TOPIC.RPC,
		action: C.ACTIONS.ERROR,
		data: [ type, msg ]
	};

	this._options.messageConnector.publish( this._receiverPrivateTopic, errorMsg );
};

/**
 * This method will be invoked for every message that's received on the private
 * topic - so a large part of what it does is establish if the message was
 * actually meant for this proxy.
 *
 * If it is, the message.topic property will be reset to the original topic
 * and the message will be forwarded
 *
 * @param   {Object} message
 *
 * @private
 * @returns {void}
 */
RpcProxy.prototype._processIncomingMessage = function( message ) {
	if( message.originalTopic !== C.TOPIC.RPC ) {
		return;
	}

	if( !message.data || message.data.length < 2 ) {
		return;
	}

	if( message.data[ 0 ] !== this._rpcName || message.data[ 1 ] !== this._correlationId ) {
		return;
	}

	message.topic = message.originalTopic;
	this.emit( C.TOPIC.RPC, message );
};

module.exports = RpcProxy;