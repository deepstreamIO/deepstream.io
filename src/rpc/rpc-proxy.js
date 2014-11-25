var C = require( '../constants/constants' ),
	events = require( 'events' ),
	utils = require( 'util' );

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky bugger.
 *
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

RpcProxy.prototype.destroy = function() {
	this._options.messageConnector.unsubscribe( this._privateTopic, this._processIncomingMessageFn );
};

RpcProxy.prototype.send = function( message ) {
	message.remotePrivateTopic = this._privateTopic;
	message.topic = this._receiverPrivateTopic;
	message.originalTopic = C.TOPIC.RPC;
	this._options.messageConnector.publish( this._receiverPrivateTopic, message );
	message.isCompleted = true;
};

RpcProxy.prototype.sendError = function() {
	console.log( 'PROXY ERROR'.yellow, arguments );
	//@todo forward
};

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