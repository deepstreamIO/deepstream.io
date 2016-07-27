var C = require( '../constants/constants' ),
	messageParser = require( './message-parser' ),
	messageBuilder = require( './message-builder' ),
	SocketWrapper = require( './socket-wrapper' ),
	engine = require('engine.io'),
	TcpEndpoint = require( '../tcp/tcp-endpoint' ),
	fileUtils = require( '../config/file-utils' ),
	events = require( 'events' ),
	util = require( 'util' ),
	https = require('https'),
	http = require('http'),
	ENGINE_IO = 0,
	TCP_ENDPOINT = 1,
	READY_STATE_CLOSED = 'closed';

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 *
 * @constructor
 *
 * @extends events.EventEmitter
 *
 * @param {Object} options the extended default options
 * @param {Function} readyCallback will be invoked once both the engineIo and the tcp connection are established
 */
var ConnectionEndpoint = function( options, readyCallback ) {
	this._options = options;
	this._readyCallback = readyCallback;

	if( !options.webServerEnabled && !options.tcpServerEnabled ) {
		throw new Error( 'Can\'t start deepstream with both webserver and tcp disabled' );
	}
	if( options.tcpServerEnabled ) {
		// Initialise a tcp server to facilitate fast and compatible communication with backend systems
		this._tcpEndpointReady = false;
		this._tcpEndpoint = new TcpEndpoint( options, this._checkReady.bind( this, TCP_ENDPOINT ) );
		this._tcpEndpoint.on( 'error', this._onError.bind( this ) );
		this._tcpEndpoint.on( 'connection', this._onConnection.bind( this, TCP_ENDPOINT ) );
	}
	if( options.webServerEnabled ) {
		// Initialise engine.io's server - a combined http and websocket server for browser connections
		this._engineIoReady = false;
		this._engineIoServerClosed = false;

		if( this._options.httpServer ) {
			this._server = this._options.httpServer;
		} else {
			this._server = this._createHttpServer();
			this._server.listen( this._options.port, this._options.host );
		}
		this._engineIo = engine.attach( this._server, { path: this._options.urlPath } );
		try
		{
			// Since uws doesn't work on windows but is required by windows
			// we provide a fake module to patch it if necassary, and look it up
			// from libs incase of a binary deployment since it's a native module
			var req = global && global.require ? global.require : require;
			const uws = req( fileUtils.lookupLibRequirePath( 'uws' ) );
			if( !uws.Server ) {
				throw '';
			}
			this._engineIo.ws = new ( uws.Server ) ({
					noServer: true,
					clientTracking: false,
					perMessageDeflate: false
			} );
			this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'Using uws websocket server' );
		} catch( e ) {
			this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, 'Using ws websocket server' );
		}

		if( this._server.listening === true || this._server._handle != null ) {
			this._checkReady( ENGINE_IO );
		} else {
			this._server.once( 'listening', this._checkReady.bind( this, ENGINE_IO ) );
		}

		this._engineIo.on( 'error', this._onError.bind( this ) );
		this._engineIo.on( 'connection', this._onConnection.bind( this, ENGINE_IO ) );
	}


	this._timeout = null;
	this._msgNum = 0;
	this._authenticatedSockets = [];
};

util.inherits( ConnectionEndpoint, events.EventEmitter );

/**
 * Called for every message that's received
 * from an authenticated socket
 *
 * This method will be overridden by an external class and is used instead
 * of an event emitter to improve the performance of the messaging pipeline
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {String} message the raw message as sent by the client
 *
 * @public
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype.onMessage = function( socketWrapper, message ) {};

/**
 * Closes both the engine.io connection and the tcp connection. The ConnectionEndpoint
 * will emit a close event once both are succesfully shut down
 *
 * @public
 * @returns {void}
 */
ConnectionEndpoint.prototype.close = function() {
	// Close the engine.io server
	if( this._engineIo ) {
		this._closeEngineIoServer();
	}

	// Close the tcp server
	if( this._tcpEndpoint ) {
		this._closeTcpServer();
	}
};

/**
 * Closes the engine.io and subsequently http server
 *
 * TODO: Make sure that engine.io and the http server's
 * clode events align and potentially don't close
 * the http server if it's provided as an external parameter
 * and might be used by express etc...
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._closeEngineIoServer = function() {
	this._server.removeAllListeners( 'request' );
	this._engineIo.removeAllListeners( 'connection' );
	for( var engineIoClient in this._engineIo.clients ) {
		if( this._engineIo.clients[ engineIoClient ].readyState !== READY_STATE_CLOSED ) {
			this._engineIo.clients[ engineIoClient ].once( 'close', this._checkClosed.bind( this ) );
		}
	}
	this._engineIo.close();

	if( this._options.httpServer ) {
		this._engineIoServerClosed = true;
		this._checkClosed();
	} else {
		this._server.close( function(){
			this._engineIoServerClosed = true;
			this._checkClosed();
		}.bind( this ) );
	}
};

/**
 * Issues a close command to the tcp server and subscribes
 * to its close event
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._closeTcpServer = function() {
	this._tcpEndpoint.removeAllListeners( 'connection' );
	this._tcpEndpoint.on( 'close', this._checkClosed.bind( this ) );
	this._tcpEndpoint.close();
};

/**
 * Creates an HTTP or HTTPS server for engine.io to attach itself to,
 * depending on the options the client configured
 *
 * @private
 * @returns {http.HttpServer | http.HttpsServer}
 */
ConnectionEndpoint.prototype._createHttpServer = function() {
	if( this._isHttpsServer() ) {

		var httpsOptions = {
			key: this._options.sslKey,
			cert: this._options.sslCert
		};

		if ( this._options.sslCa ) {
			httpsOptions.ca = this._options.sslCa;
		}

		return https.createServer( httpsOptions );
	} else {
		return http.createServer();
	}
};

/**
 * Called whenever either the tcp server itself or one of its sockets
 * is closed. Once everything is closed it will emit a close event
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._checkClosed = function() {

	if( this._tcpEndpoint && this._tcpEndpoint.isClosed === false ) {
		return;
	}

	if( this._engineIo && ( this._engineIo.clientsCount > 0 || this._engineIoServerClosed === false ) ) {
		return;
	}

	this.emit( 'close' );
};

/**
 * Callback for 'connection' event. Receives
 * a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user and
 * subscribes to authentication messages.
 *
 * @param {Number} endpoint
 * @param {TCPSocket|Engine.io} socket
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._onConnection = function( endpoint, socket ) {
	var socketWrapper = new SocketWrapper( socket, this._options ),
		handshakeData = socketWrapper.getHandshakeData(),
		logMsg,
		disconnectTimer;

	if( endpoint === ENGINE_IO ) {
		logMsg = 'from ' + handshakeData.referer + ' (' + handshakeData.remoteAddress + ')' + ' via engine.io';
	} else {
		logMsg = 'from ' + handshakeData.remoteAddress + ' via tcp';
	}

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INCOMING_CONNECTION, logMsg );

	if( this._options.unauthenticatedClientTimeout !== null ) {
		disconnectTimer = setTimeout( this._processConnectionTimeout.bind( this, socketWrapper ), this._options.unauthenticatedClientTimeout );
		socketWrapper.socket.once( 'close', clearTimeout.bind( null, disconnectTimer ) );
	}

	socketWrapper.authCallBack = this._authenticateConnection.bind( this, socketWrapper, disconnectTimer );

	socketWrapper.sendMessage( C.TOPIC.CONNECTION, C.ACTIONS.ACK );

	socket.on( 'message', socketWrapper.authCallBack );
};

/**
 * Callback for the first message that's received from the socket.
 * This is expected to be an auth-message. This method makes sure that's
 * the case and - if so - forwards it to the permission handler for authentication
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Timeout} disconnectTimeout
 * @param   {String} authMsg
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._authenticateConnection = function( socketWrapper, disconnectTimeout, authMsg ) {
	var msg = messageParser.parse( authMsg )[ 0 ],
		logMsg,
		authData,
		errorMsg;

	/**
	 * Log the authentication attempt
	 */
	logMsg = socketWrapper.getHandshakeData().remoteAddress  + ': ' + authMsg;
	this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.AUTH_ATTEMPT, logMsg );

	/**
	 * Ensure the message is a valid authentication message
	 */
	if( !msg || msg.topic !== C.TOPIC.AUTH || msg.action !== C.ACTIONS.REQUEST || msg.data.length !== 1 ) {
		errorMsg = this._options.logInvalidAuthData === true ? authMsg : '';
		this._sendInvalidAuthMsg( socketWrapper, errorMsg );
		return;
	}

	/**
	 * Ensure the authentication data is valid JSON
	 */
	try{
		authData = JSON.parse( msg.data[ 0 ] );
	} catch( e ) {
		errorMsg = 'Error parsing auth message';

		if( this._options.logInvalidAuthData === true ) {
			errorMsg += ' "' + authMsg + '": ' + e.toString();
		}

		this._sendInvalidAuthMsg( socketWrapper, errorMsg );
		return;
	}

	/**
	 * Forward for authentication
	 */
	this._options.authenticationHandler.isValidUser(
		socketWrapper.getHandshakeData(),
		authData,
		this._processAuthResult.bind( this, authData, socketWrapper, disconnectTimeout )
	);
};

/**
 * Will be called for syntactically incorrect auth messages. Logs
 * the message, sends an error to the client and closes the socket
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {String} msg the raw message as sent by the client
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._sendInvalidAuthMsg = function( socketWrapper, msg ) {
	this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_AUTH_MSG, this._options.logInvalidAuthData ? msg : '' );
	socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.INVALID_AUTH_MSG, 'invalid authentication message' );
	socketWrapper.destroy();
};

/**
 * Callback for succesfully validated sockets. Removes
 * all authentication specific logic and registeres the
 * socket with the authenticated sockets
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {String} username
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._registerAuthenticatedSocket  = function( socketWrapper, userData ) {
	socketWrapper.socket.removeListener( 'message', socketWrapper.authCallBack );
	socketWrapper.socket.once( 'close', this._onSocketClose.bind( this, socketWrapper ) );
	socketWrapper.socket.on( 'message', function( msg ){ this.onMessage( socketWrapper, msg ); }.bind( this ));
	socketWrapper.user = userData.username || 'OPEN';
	socketWrapper.authData = userData.serverData || null;
	if( typeof userData.clientData === 'undefined' ) {
		socketWrapper.sendMessage( C.TOPIC.AUTH, C.ACTIONS.ACK );
	} else {
		socketWrapper.sendMessage( C.TOPIC.AUTH, C.ACTIONS.ACK, [ messageBuilder.typed( userData.clientData ) ] );
	}

	this._authenticatedSockets.push( socketWrapper );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.AUTH_SUCCESSFUL, socketWrapper.user );
};

/**
 * Callback for invalid credentials. Will notify the client
 * of the invalid auth attempt. If the number of invalid attempts
 * exceed the threshold specified in options.maxAuthAttempts
 * the client will be notified and the socket destroyed.
 *
 * @param   {Object} authData the (invalid) auth data
 * @param   {SocketWrapper} socketWrapper
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._processInvalidAuth = function( clientData, authData, socketWrapper ) {
	var logMsg = 'invalid authentication data';

	if( this._options.logInvalidAuthData === true ) {
		logMsg += ': ' + JSON.stringify( authData );
	}

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INVALID_AUTH_DATA, logMsg );
	socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.INVALID_AUTH_DATA, messageBuilder.typed( clientData ) );
	socketWrapper.authAttempts++;

	if( socketWrapper.authAttempts >= this._options.maxAuthAttempts ) {
		this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, 'too many authentication attempts' );
		socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, messageBuilder.typed( 'too many authentication attempts' ) );
		socketWrapper.destroy();
	}
};

/**
 * Callback for connections that have not authenticated succesfully within
 * the expected timeframe
 *
 * @param   {SocketWrapper} socketWrapper
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._processConnectionTimeout = function( socketWrapper ) {
	var log = 'connection has not authenticated successfully in the expected time';
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT, log );
	socketWrapper.sendError( C.TOPIC.CONNECTION, C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT, messageBuilder.typed( log ) );
	socketWrapper.destroy();
};

/**
 * Callback for the results returned by the permissionHandler
 *
 * @param   {Object} authData
 * @param   {SocketWrapper} socketWrapper
 * @param   {Boolean} isAllowed
 * @param   {Object} userData
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._processAuthResult = function( authData, socketWrapper, disconnectTimeout, isAllowed, userData ) {
	userData = userData || {};

	clearTimeout( disconnectTimeout );

	if( isAllowed === true ) {
		this._registerAuthenticatedSocket( socketWrapper, userData );
	} else {
		this._processInvalidAuth( userData.clientData, authData, socketWrapper );//todo
	}
};

/**
 * Called for the ready events of both the engine.io server and the tcp server.
 *
 * @param   {String} endpoint An endpoint constant
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._checkReady = function( endpoint ) {
	var msg, address, tcpEndpointReady, engineIoReady;

	if( endpoint === ENGINE_IO ) {
		address = this._server.address();
		msg = 'Listening for browser connections on ' + address.address + ':' + address.port;
		this._engineIoReady = true;
	}

	if( endpoint === TCP_ENDPOINT ) {
		msg = 'Listening for tcp connections on ' + this._options.tcpHost + ':' + this._options.tcpPort;
		this._tcpEndpointReady = true;
	}

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, msg );

	tcpEndpointReady = !this._tcpEndpoint || this._tcpEndpointReady === true;
	engineIoReady = !this._engineIo || this._engineIoReady === true;

	if( tcpEndpointReady && engineIoReady ) {
		this._readyCallback();
	}
};

/**
 * Generic callback for connection errors. This will most often be called
 * if the configured port number isn't available
 *
 * @param   {String} error
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._onError = function( error ) {
	this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.CONNECTION_ERROR, error );
};

/**
* Notifies the (optional) onClientDisconnect method of the permissionHandler
* that the specified client has disconnected
*
* @param {SocketWrapper} socketWrapper
*
* @private
* @returns {void}
*/
ConnectionEndpoint.prototype._onSocketClose = function( socketWrapper ) {
	if( this._options.authenticationHandler.onClientDisconnect ) {
		this._options.authenticationHandler.onClientDisconnect( socketWrapper.user );
	}
};

/**
* Returns whether or not sslKey and sslCert have been set to start a https server.
*
* @throws Will throw an error if only sslKey or sslCert have been specified
*
* @private
* @returns {boolean}
*/
ConnectionEndpoint.prototype._isHttpsServer = function( ) {
	var isHttps = false;
	if( this._options.sslKey || this._options.sslCert ) {
		if( !this._options.sslKey ) {
			throw new Error( 'Must also include sslKey in order to use HTTPS' );
		}
		if( !this._options.sslCert ) {
			throw new Error( 'Must also include sslCert in order to use HTTPS' );
		}
		isHttps = true;
	}
	return isHttps;
};

module.exports = ConnectionEndpoint;
