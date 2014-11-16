var ConnectionEndpoint = require( './message/connection-endpoint' ),
	MessageProcessor = require( './message/message-processor' ),
	MessageDistributor = require( './message/message-distributor' ),
	EventHandler = require( './event/event-handler' ),
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
};

Deepstream.prototype.set = function( key, value ) {

};

Deepstream.prototype.start = function() {
	this._engineIo = engine.listen( this._options.port );//@TODO add host
	this._connectionEndpoint = new ConnectionEndpoint( this._engineIo, this._options );
	this._messageProcessor = new MessageProcessor( this._options );
	this._messageDistributor = new MessageDistributor( this._options );
	this._connectionEndpoint.onMessage = this._messageProcessor.process.bind( this._messageProcessor );

	this._eventHandler = new EventHandler( this._connectionEndpoint, this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.EVENT, this._eventHandler.handle.bind( this._eventHandler ) );

	this._messageProcessor.onAuthenticatedMessage = this._messageDistributor.distribute.bind( this._messageDistributor );
};

exports.Deepstream = Deepstream;