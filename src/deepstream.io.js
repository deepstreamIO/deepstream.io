var ConnectionEndpoint = require( './message/connection-endpoint' ),
	MessageProcessor = require( './message/message-processor' ),
	MessageDistributor = require( './message/message-distributor' ),
	EventHandler = require( './event/event-handler' ),
	RpcHandler = require( './rpc/rpc-handler' ),
	C = require( './constants/constants' ),
	engine = require('engine.io');

	require( 'colors' );

var Deepstream = function() {
	this._options = require( './default-options' );
	this._connectionEndpoint = null;
	this._engineIo = null;
	this._messageProcessor = null;
	this._messageDistributor = null;
	this._eventHandler = null;
	this._rpcHandler = null;
};

Deepstream.prototype.set = function( key, value ) {
	if( this._options[ key ] === undefined ) {
		throw new Error( 'Unknown option "' + key + '"' );
	}

	this._options[ key ] = value;
};

Deepstream.prototype.start = function() {
	this._checkReady();
};

Deepstream.prototype._init = function() {
	this._engineIo = engine.listen( this._options.port, this._options.host );
	this._connectionEndpoint = new ConnectionEndpoint( this._engineIo, this._options );
	this._messageProcessor = new MessageProcessor( this._options );
	this._messageDistributor = new MessageDistributor( this._options );
	this._connectionEndpoint.onMessage = this._messageProcessor.process.bind( this._messageProcessor );

	this._eventHandler = new EventHandler( this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.EVENT, this._eventHandler.handle.bind( this._eventHandler ) );
	
	this._rpcHandler = new RpcHandler( this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.RPC, this._rpcHandler.handle.bind( this._rpcHandler ) );
	
	this._messageProcessor.onAuthenticatedMessage = this._messageDistributor.distribute.bind( this._messageDistributor );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'DeepStream started on ' + this._options.host + ':' + this._options.port );
};

Deepstream.prototype._checkReady = function() {
	if( this._options.messageConnector.isReady !== true ) {
		this._options.messageConnector.once( 'ready', this._checkReady.bind( this ) );
		return;
	}

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'messageConnector ready' );
	this._init();
};

exports.Deepstream = Deepstream;