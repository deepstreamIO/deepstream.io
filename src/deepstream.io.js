var ConnectionEndpoint = require( './message/connection-endpoint' ),
	MessageProcessor = require( './message/message-processor' ),
	MessageDistributor = require( './message/message-distributor' ),
	DataTransforms = require( './message/data-transforms' ),
	EventHandler = require( './event/event-handler' ),
	EventEmitter = require( 'events' ).EventEmitter,
	messageParser = require( './message/message-parser' ),
	readMessage = require( './utils/read-message' ),
	EOL = require( 'os' ).EOL,
	fs = require( 'fs' ),
	path = require( 'path' ),
	util = require( 'util' ),
	utils = require( './utils/utils' ),
	defaultOptions = require( './default-options' ),
	configInitialiser = require( './config/config-initialiser' ),
	jsYamlLoader = require( './config/js-yaml-loader' ),
	RpcHandler = require( './rpc/rpc-handler' ),
	RecordHandler = require( './record/record-handler' ),
	WebRtcHandler = require( './webrtc/webrtc-handler' ),
	DependencyInitialiser = require( './utils/dependency-initialiser' ),
	C = require( './constants/constants' ),
	pkg = require( '../package.json' );

const STATES = C.STATES;

/**
 * Deepstream is a realtime data server that scales horizontally
 * by running in clusters of interacting nodes
 *
 * @copyright 2016 deepstreamHub GmbH
 * @author deepstreamHub GmbH
 *
 * @param {Object} config Configuration object
 *
 * @constructor
 */
var Deepstream = function( config ) {
	this._currentState = STATES.CLOSED;
	this.constants = C;
	this._loadConfig( config );
	this._connectionEndpoint = null;
	this._engineIo = null;
	this._messageProcessor = null;
	this._messageDistributor = null;
	this._eventHandler = null;
	this._rpcHandler = null;
	this._recordHandler = null;
	this._webRtcHandler = null;
	this._plugins = [
		'messageConnector',
		'storage',
		'cache',
		'authenticationHandler',
		'permissionHandler'
	];

};

util.inherits( Deepstream, EventEmitter );

/**
 * Sets the name of the process
 *
 * @type {String}
 */
process.title = 'deepstream server';

/**
 * Expose constants to allow consumers to access them without
 * requiring a reference to a deepstream instance.
 *
 *
*/
Deepstream.constants = C;


/**
 * Utility method to return a helper object to simplify permissions assertions
 *
 * @param  {object} message description
 * @return {object}         description
 */
Deepstream.readMessage = readMessage;

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
	if( key === 'message' ) {
		key = 'messageConnector';
	}

	if( this._options[ key ] === undefined ) {
		throw new Error( 'Unknown option "' + key + '"' );
	}

	this._options[ key ] = value;
	return this;
};

/**
 * Returns true if the deepstream server is running, otherwise false
 *
 * @public
 * @returns {boolean}
 */
Deepstream.prototype.isRunning = function() {
	return this._currentState === STATES.IS_RUNNING;
};

/**
 * Starts up deepstream. The startup process has three steps:
 *
 * - First of all initialise the logger and wait for it (ready event)
 * - Then initialise all other dependencies (cache connector, message connector, storage connector)
 * - Instantiate the messaging pipeline and record-, rpc- and event-handler
 * - Start TCP and HTTP server
 *
 * @public
 * @returns {void}
 */
Deepstream.prototype.start = function() {
	if( this._currentState !== STATES.CLOSED ) {
		throw new Error( `Server can only start after it stops succesfully, currently ${this._currentState}` );
	}
	this._currentState = STATES.STARTING;
	this._showStartLogo();
	var loggerInitializer = new DependencyInitialiser( this._options, 'logger' );
	loggerInitializer.once( 'ready', this._start.bind( this ) );
};

/**
 * This is the actual function which starts deepstream. It is invoked after+
 * the logger was intialized or emitted the read event if it was initialized
 * asynchronously
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._start = function() {
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO,  'deepstream version: ' + pkg.version );

	// otherwise (no configFile) deepstream was invoked by API
	if( this._configFile != null ) {
		this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'configuration file loaded from ' + this._configFile );
	}

	if( global.deepstreamLibDir ) {
		this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'library directory set to: ' + global.deepstreamLibDir );
	}

	if( this._options.dataTransforms && this._options.dataTransforms instanceof Array ) {
		this._options.dataTransforms = new DataTransforms( this._options.dataTransforms );
	}

	var i,
		initialiser;

	for( i = 0; i < this._plugins.length; i++ ) {
		initialiser = new DependencyInitialiser( this._options, this._plugins[ i ] );
		initialiser.once( 'ready', this._checkReady.bind( this, this._plugins[ i ], initialiser.getDependency() ) );
	}
	this._checkReady( 'logger', this._options.logger );
};

/**
 * Stops the server and closes all connections. The server can be started again,
 * but all clients have to reconnect. Will emit a 'stopped' event once done
 *
 * @public
 * @returns {void}
 */
Deepstream.prototype.stop = function() {
	if( this._currentState !== STATES.IS_RUNNING ) {
		throw new Error( `Server can only be stopped after it starts succesfully, currently ${this._currentState}` )
	}
	this._currentState = STATES.CLOSING;

	var i,
		plugin,
		closables = [ this._connectionEndpoint ];

	if( typeof this._options.logger.close === 'function' ) {
		closables.push( this._options.logger );
		setTimeout( this._options.logger.close.bind( this._options.logger ) );
	}

	for( i = 0; i < this._plugins.length; i++ ) {
		plugin = this._options[ this._plugins[ i ] ];
		if( typeof plugin.close === 'function' ) {
			closables.push( plugin );
			setTimeout( plugin.close.bind( plugin ) );
		}
	}

	utils.combineEvents( closables, 'close', this._onStopped.bind( this ) );
	this._connectionEndpoint.close();
};

/**
 * Expose the message-parser's convertTyped method
 * so that it can be used within permissionHandlers
 *
 * @param   {String} value A String starting with a type identifier (see C.TYPES)
 *
 * @public
 * @returns {mixed} the converted value
 */
Deepstream.prototype.convertTyped = function( value ) {
	return messageParser.convertTyped( value );
};

/**
 * Synchronously loads a configuration file
 * Initialization of plugins and logger will be triggered by the
 * configInitialiser, but it should not block. Instead the ready events of
 * those plugins are handled through the DependencyInitialiser in this instnace.
 *
 * @param {Object} config Configuration object
 * @private
 * @returns {void}
 */
Deepstream.prototype._loadConfig = function( config ) {
	if ( config === null || typeof config === 'string' ) {
		var result = jsYamlLoader.loadConfig( config );
		this._configFile = result.file;
		config = result.config;
	} else {
		var rawConfig = utils.merge( defaultOptions.get(), config );
		config = configInitialiser.initialise( rawConfig );
	}
	this._options = config;
};

/**
 * Callback for the final stop event
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._onStopped = function() {
	this._currentState = STATES.CLOSED;
	this.emit( 'stopped' );
};

/**
 * Shows a giant ASCII art logo which is absolutely crucial
 * for the proper functioning of the server
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._showStartLogo = function() {
	if( this._options.showLogo !== true ) {
		return;
	}
	/* istanbul ignore next */
	var logo;

	try {
		const nexeres = require( 'nexeres' );
		logo = nexeres.get( 'ascii-logo.txt' ).toString( 'ascii' );
	}
	catch( e ) {
		logo = fs.readFileSync( path.join(__dirname, '..', '/ascii-logo.txt'), 'utf8' );
	}

	/* istanbul ignore next */
	process.stdout.write( logo + EOL );
	process.stdout.write( ' =========================   starting   ==========================' + EOL );
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

	this._webRtcHandler = new WebRtcHandler( this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.WEBRTC, this._webRtcHandler.handle.bind( this._webRtcHandler ) );

	this._recordHandler = new RecordHandler( this._options );
	this._messageDistributor.registerForTopic( C.TOPIC.RECORD, this._recordHandler.handle.bind( this._recordHandler ) );

	this._messageProcessor.onAuthenticatedMessage = this._messageDistributor.distribute.bind( this._messageDistributor );

	if( this._options.permissionHandler.setRecordHandler ) {
		this._options.permissionHandler.setRecordHandler( this._recordHandler );
	}

	this._currentState = STATES.INITIALIZED;
};

/**
 * Called whenever a dependency emits a ready event. Once all dependencies are ready
 * deepstream moves to the init step.
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._checkReady = function( pluginName, plugin ) {
	if( plugin instanceof EventEmitter ) {
		plugin.on( 'error', this._onPluginError.bind( this, pluginName ) );
	}

	for( var i = 0; i < this._plugins.length; i++ ) {
		if( this._options[ this._plugins[ i ] ].isReady !== true ) {
			return;
		}
	}

	if( this._currentState === STATES.STARTING ) {
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
	this._currentState = STATES.IS_RUNNING;
	this.emit( 'started' );
};

/**
 * Callback for plugin errors that occur at runtime. Errors during initialisation
 * are handled by the DependencyInitialiser
 *
 * @param   {String} pluginName
 * @param   {Error} error
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._onPluginError = function( pluginName, error  ) {
	var msg = 'Error from ' + pluginName + ' plugin: ' + error.toString();
	this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.PLUGIN_ERROR, msg );
};

module.exports = Deepstream;
