var ConnectionEndpoint = require( './message/connection-endpoint' ),
	MessageProcessor = require( './message/message-processor' ),
	MessageDistributor = require( './message/message-distributor' ),
	EventHandler = require( './event/event-handler' ),
	RpcHandler = require( './rpc/rpc-handler' ),
	RecordHandler = require( './record/record-handler' ),
	DependencyInitialiser = require( './utils/dependency-initialiser' ),
	C = require( './constants/constants' );

	require( 'colors' );

var Deepstream = function() {
	this._options = require( './default-options' );
	this._connectionEndpoint = null;
	this._engineIo = null;
	this._messageProcessor = null;
	this._messageDistributor = null;
	this._eventHandler = null;
	this._rpcHandler = null;
	this._recordHandler = null;
	this._initialised = false;
	this._plugins = [ 
		'messageConnector',
		'storage',
		'cache',
		'logger'
	];
};

process.title = 'deepstream server';

Deepstream.prototype.set = function( key, value ) {
	if( this._options[ key ] === undefined ) {
		throw new Error( 'Unknown option "' + key + '"' );
	}

	this._options[ key ] = value;
};

Deepstream.prototype.start = function() {
	this._showStartLogo();

	var i,
		initialiser;

	for( i = 0; i < this._plugins.length; i++ ) {
		initialiser = new DependencyInitialiser( this._options, this._plugins[ i ] );
		initialiser.once( 'ready', this._checkReady.bind( this ));
	}
};

Deepstream.prototype._showStartLogo = function() {
	console.log( ' _____________________________________________________________________________'.yellow );
	console.log( '                                                                              '.yellow );
	console.log( '         /                                                             ,      '.yellow );
	console.log( ' ----__-/----__----__------__---__--_/_---)__----__----__---_--_-----------__-'.yellow );
	console.log( '   /   /   /___) /___)   /   ) (_ ` /    /   ) /___) /   ) / /  )    /   /   )'.yellow );
	console.log( ' _(___/___(___ _(___ ___/___/_(__)_(_ __/_____(___ _(___(_/_/__/__o_/___(___/_'.yellow );
	console.log( '                       /                                                      '.yellow );
	console.log( '                      /                                                       '.yellow );
	console.log( '=============================== STARTING... =================================='.yellow );
};

Deepstream.prototype._init = function() {
	this._connectionEndpoint = new ConnectionEndpoint( this._options );
	this._messageProcessor = new MessageProcessor( this._options );
	this._messageDistributor = new MessageDistributor( this._options );
	this._connectionEndpoint.onMessage = this._messageProcessor.process.bind( this._messageProcessor );

	this._eventHandler = new EventHandler( this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.EVENT, this._eventHandler.handle.bind( this._eventHandler ) );
	
	this._rpcHandler = new RpcHandler( this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.RPC, this._rpcHandler.handle.bind( this._rpcHandler ) );
	
	this._recordHandler = new RecordHandler( this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.RECORD, this._recordHandler.handle.bind( this._recordHandler ) );

	this._messageProcessor.onAuthenticatedMessage = this._messageDistributor.distribute.bind( this._messageDistributor );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'DeepStream started on ' + this._options.host + ':' + this._options.port );

	this._initialised = true;
};

Deepstream.prototype._checkReady = function() {
	for( var i = 0; i < this._plugins.length; i++ ) {
		if( this._options[ this._plugins[ i ] ].isReady !== true ) {
			return;
		}
	}
	
	if( this._initialised === false ) {
		this._init();
	}
};

module.exports = Deepstream;