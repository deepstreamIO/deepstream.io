var C = require( '../constants/constants' ),
	events = require( 'events' ),
	utils = require( 'util' );

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky.
 *
 * @param {Object} options
 * @param {String} receiverPrivateTopic
 * @param {String} rpcName
 * @param {String} correlationId
 *
 * @extends {EventEmitter}
 * @constructor
 */
var RpcProxy = function( options, receiverPrivateTopic ) {
	this._options = options;
	this._receiverPrivateTopic = receiverPrivateTopic;
	this._privateTopic = C.TOPIC.PRIVATE + this._options.serverName;
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

module.exports = RpcProxy;