var ConnectionEndpoint = require( './message/connection-endpoint' ),
	MessageProcessor = require( './message/message-processor' ),
	MessageDistributor = require( './message/message-distributor' ),
	EventHandler = require( './event/event-handler' ),
	RpcHandler = require( './rpc/rpc-handler' ),
	RecordHandler = require( './record/record-handler' ),
	DependencyInitialiser = require( './utils/dependency-initialiser' ),
	C = require( './constants/constants' );

require( 'colors' );

/**
 * Deepstream is a realtime data server that scales horizontally
 * by running in clusters of interacting nodes
 *
 * @copyright 2015 Hoxton-One Ltd.
 * @author Wolfram Hempel
 * @version <version>
 * 
 * @constructor
 */
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

/**
 * Sets the name of the process
 *
 * @type {String}
 */
process.title = 'deepstream server';

/**
 * Set a deepstream option. For a list of all available options
 * please see default-options.
 *
 * @param {String} key   the name of the option
 * @param {Mixed} value  the value, e.g. a portnumber for ports or an instance of a logger class
 *
 * @public
 * @returns {void}
 */
Deepstream.prototype.set = function( key, value ) {
	if( this._options[ key ] === undefined ) {
		throw new Error( 'Unknown option "' + key + '"' );
	}

	this._options[ key ] = value;
};

/**
 * Starts up deepstream. The startup process has three steps:
 * 
 * - Initialise all dependencies (cache connector, message connector, storage connector and logger)
 * - Instantiate the messaging pipeline and record-, rpc- and event-handler
 * - Start TCP and HTTP server
 *
 * @public
 * @returns {void}
 */
Deepstream.prototype.start = function() {
	this._showStartLogo();
	this._options.logger._$useColors = this._options.colors;

	var i,
		initialiser;

	for( i = 0; i < this._plugins.length; i++ ) {
		initialiser = new DependencyInitialiser( this._options, this._plugins[ i ] );
		initialiser.once( 'ready', this._checkReady.bind( this ));
	}
};

/**
 * Shows a giant ASCII art logo which is absolutely crucial
 * for the proper functioning of the server
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._showStartLogo = function() {
	var logo =
	' _____________________________________________________________________________\n'+
	'                                                                              \n'+
	'         /                                                             ,      \n'+
	' ----__-/----__----__------__---__--_/_---)__----__----__---_--_-----------__-\n'+
	'   /   /   /___) /___)   /   ) (_ ` /    /   ) /___) /   ) / /  )    /   /   )\n'+
	' _(___/___(___ _(___ ___/___/_(__)_(_ __/_____(___ _(___(_/_/__/__o_/___(___/_\n'+
	'                       /                                                      \n'+
	'                      /                                                       \n'+
	'=============================== STARTING... ==================================\n';

	process.stdout.write( this._options.colors ? logo.yellow : logo );
};

/**
 * Invoked once all dependencies are initialised. Instantiates the messaging pipeline and the various handlers.
 * The startup sequence will be complete once the connection endpoint is started and listening
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._init = function() {
	this._connectionEndpoint = new ConnectionEndpoint( this._options, this._onStarted.bind( this ) );
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

	this._initialised = true;
};

/**
 * Called whenever a dependency emits a ready event. Once all dependencies are ready
 * deepstream moves to the init step.
 *
 * @private
 * @returns {void}
 */
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

/**
 * Final callback - Deepstream is up and running now
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._onStarted = function() {
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'Deepstream started' );
};

module.exports = Deepstream;