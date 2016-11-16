var C = require( '../constants/constants' ),
	messageParser = require( './message-parser' ),
	messageBuilder = require( './message-builder' ),
	SocketWrapper = require( './socket-wrapper' ),
	fileUtils = require( '../config/file-utils' ),
	events = require( 'events' ),
	util = require( 'util' ),
	http = require( 'http' ),
	https = require( 'https' ),
	uws = require('uws'),
	OPEN = 'OPEN';

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
 * @param {Function} readyCallback will be invoked once both the ws is ready
 */
var ConnectionEndpoint = function( options, readyCallback ) {
	this._options = options;
	this._readyCallback = readyCallback;

	this._wsReady = false;
	this._wsServerClosed = false;

	this._server = this._createHttpServer();
	this._server.listen( this._options.port, this._options.host );
	this._server.on('request', this._handleHealthCheck.bind( this ));
	this._options.logger.log(
		C.LOG_LEVEL.INFO,
		C.EVENT.INFO,
		'Listening for health checks on path ' + options.healthCheckPath
	);

	this._ws = new uws.Server({
		server: this._server,
		perMessageDeflate: false,
		path: this._options.urlPath
	} );
	this._ws.startAutoPing( this._options.heartbeatInterval, messageBuilder.getMsg( C.TOPIC.CONNECTION, C.ACTIONS.PING ) );
	this._server.once( 'listening', this._checkReady.bind( this ) );
	this._ws.on( 'error', this._onError.bind( this ) );
	this._ws.on( 'connection', this._onConnection.bind( this ) );

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
 * Closes the ws server connection. The ConnectionEndpoint
 * will emit a close event once succesfully shut down
 * @public
 * @returns {void}
 */
ConnectionEndpoint.prototype.close = function() {
	this._server.removeAllListeners( 'request' );
	this._ws.removeAllListeners( 'connection' );
	this._ws.close();

	this._server.close( function(){
		this._wsServerClosed = true;
		this._checkClosed();
	}.bind( this ) );
};

/**
 * Returns the number of currently connected clients. This is used by the
 * cluster module to determine loadbalancing endpoints
 *
 * @public
 * @returns {Number} connectionCount
 */
ConnectionEndpoint.prototype.getConnectionCount = function() {
	return this._authenticatedSockets.length;
};

/**
 * Creates an HTTP or HTTPS server for ws to attach itself to,
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
 * Responds to http health checks.
 * Responds with 200(OK) if deepstream is alive.
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._handleHealthCheck = function( req, res ) {
	if ( req.method === 'GET' && req.url === this._options.healthCheckPath ) {
		res.writeHead( 200 );
		res.end();
	}
}

/**
 * Called whenever either the server itself or one of its sockets
 * is closed. Once everything is closed it will emit a close event
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._checkClosed = function() {
	if( this._wsServerClosed === false ) {
		return;
	}

	this.emit( 'close' );
};

/**
 * Callback for 'connection' event. Receives
 * a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user and
* subscribes to authentication messages.
 * @param {Websocket} socket
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._onConnection = function( socket ) {
	var socketWrapper = new SocketWrapper( socket, this._options ),
		handshakeData = socketWrapper.getHandshakeData(),
		logMsg = 'from ' + handshakeData.referer + ' (' + handshakeData.remoteAddress + ')',
		disconnectTimer;

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INCOMING_CONNECTION, logMsg );

	if( this._options.unauthenticatedClientTimeout !== null ) {
		disconnectTimer = setTimeout( this._processConnectionTimeout.bind( this, socketWrapper ), this._options.unauthenticatedClientTimeout );
		socketWrapper.once( 'close', clearTimeout.bind( null, disconnectTimer ) );
	}

	socketWrapper.connectionCallback = this._processConnectionMessage.bind( this, socketWrapper );
	socketWrapper.authCallBack = this._authenticateConnection.bind( this, socketWrapper, disconnectTimer );
	socketWrapper.sendMessage( C.TOPIC.CONNECTION, C.ACTIONS.CHALLENGE );
	socket.on( 'message', socketWrapper.connectionCallback );
};

/**
 * Always challenges the client that connects. This will be opened up later to allow users to put in their
 * own challenge authentication, but requires more work on the clustering aspect first.
 *
 * @param  {SocketWrapper} socketWrapper Socket
 * @param  {Message} connectionMessage Message recieved from server
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._processConnectionMessage = function( socketWrapper, connectionMessage ) {
	var msg = messageParser.parse( connectionMessage )[ 0 ];

	if( msg === null ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PARSE_ERROR, connectionMessage );
		socketWrapper.sendError( C.TOPIC.CONNECTION, C.EVENT.MESSAGE_PARSE_ERROR, connectionMessage );
		socketWrapper.destroy();
	}
	else if( msg.topic !== C.TOPIC.CONNECTION ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE, 'invalid connection message ' + connectionMessage );
		socketWrapper.sendError( C.TOPIC.CONNECTION, C.EVENT.INVALID_MESSAGE, 'invalid connection message' );
	}
	else if( msg.action === C.ACTIONS.PONG ) {
		return;
	}
	else if( msg.action === C.ACTIONS.CHALLENGE_RESPONSE ) {
		socketWrapper.socket.removeListener( 'message', socketWrapper.connectionCallback );
		socketWrapper.socket.on( 'message', socketWrapper.authCallBack );
		socketWrapper.sendMessage( C.TOPIC.CONNECTION, C.ACTIONS.ACK );
	} else {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, msg.action );
		socketWrapper.sendError( C.TOPIC.CONNECTION, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + msg.action );
	}
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
	 * Ignore pong messages
	 */
	if( msg && msg.topic === C.TOPIC.CONNECTION && msg.action === C.ACTIONS.PONG ) {
		return;
	}

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
	socketWrapper.once( 'close', this._onSocketClose.bind( this, socketWrapper ) );
	socketWrapper.socket.on( 'message', function( msg ){ this.onMessage( socketWrapper, msg ); }.bind( this ));
	this._appendDataToSocketWrapper( socketWrapper, userData );
	if( typeof userData.clientData === 'undefined' ) {
		socketWrapper.sendMessage( C.TOPIC.AUTH, C.ACTIONS.ACK );
	} else {
		socketWrapper.sendMessage( C.TOPIC.AUTH, C.ACTIONS.ACK, [ messageBuilder.typed( userData.clientData ) ] );
	}

	if( socketWrapper.user !== OPEN ) {
		this.emit( 'client-connected', socketWrapper );
	}

	this._authenticatedSockets.push( socketWrapper );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.AUTH_SUCCESSFUL, socketWrapper.user );
};

/**
 * Append connection data to the socket wrapper
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} userData the data to append to the socket wrapper
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._appendDataToSocketWrapper = function( socketWrapper, userData ) {
	socketWrapper.user = userData.username || OPEN;
	socketWrapper.authData = userData.serverData || null;
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
 * Called for the ready event of the ws server.
 *
 * @param   {String} endpoint An endpoint constant
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._checkReady = function( endpoint ) {
	var msg, address, wsReady;

	var address = this._server.address();
	var msg = `Listening for websocket connections on ${address.address}:${address.port}${this._options.urlPath}`;
	this._wsReady = true;

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, msg );
	this._readyCallback();
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

	if( socketWrapper.user !== OPEN ) {
		this.emit( 'client-disconnected', socketWrapper );
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
