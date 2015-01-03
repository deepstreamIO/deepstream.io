var C = require( '../constants/constants' ),
	messageParser = require( './message-parser' ),
	SocketWrapper = require( './socket-wrapper' ),
	engine = require('engine.io'),
	TcpEndpoint = require( '../tcp/tcp-endpoint' );

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connection and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 *
 * @constructor
 * 
 * @param {Object} options the extended default options
 */
var ConnectionEndpoint = function( options ) {
	this._options = options;

	this._engineIo = engine.listen( this._options.port, this._options.host );
	this._engineIo.on( 'error', this._onError.bind( this ) );
	this._engineIo.on( 'connection', this._onConnection.bind( this ) );

	this._tcpEndpoint = new TcpEndpoint( options );
	this._tcpEndpoint.on( 'error', this._onError.bind( this ) );
	this._tcpEndpoint.on( 'connection', this._onConnection.bind( this ) );

	this._timeout = null;
	this._msgNum = 0;
	this._authenticatedSockets = [];
};

/**
 * Called for every message that's received
 * from an authenticated socket
 *
 * @override
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
 * Callback for engine.io's 'connection' event. Receives
 * a connected socket, wraps it in a SocketWrapper and
 * subscribes to authentication messages
 *
 * @param   {engine.io Socket} socket
 *
 * @private
 * @returns {void}
 */
ConnectionEndpoint.prototype._onConnection = function( socket ) {
	var socketWrapper = new SocketWrapper( socket, this._options );
	socketWrapper.authCallBack = this._authenticateConnection.bind( this, socketWrapper );
	socket.on( 'message', socketWrapper.authCallBack );
};

/**
 * Callback for the first message that's received from the socket.
 * This is expected to be an auth-message. This method makes sure that's
 * the case and - if so - forwards it to the permission handler for authentication
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {String} authMsg
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._authenticateConnection = function( socketWrapper, authMsg ) {
	this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.AUTH_ATTEMPT, authMsg );

	var msg = messageParser.parse( authMsg )[ 0 ],
		authData,
		errorMsg;

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
	this._options.permissionHandler.isValidUser( 
		socketWrapper.getHandshakeData(), 
		authData,
		this._processAuthResult.bind( this, authData, socketWrapper ) 
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
ConnectionEndpoint.prototype._registerAuthenticatedSocket  = function( socketWrapper, username ) {
	socketWrapper.socket.removeListener( 'message', socketWrapper.authCallBack );
	socketWrapper.socket.on( 'message', function( msg ){ this.onMessage( socketWrapper, msg ); }.bind( this ));
	socketWrapper.user = username;
	socketWrapper.sendMessage( C.TOPIC.AUTH, C.ACTIONS.ACK );
	this._authenticatedSockets.push( socketWrapper );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.AUTH_SUCCESSFUL, username );
};

/**
 * Callback for invalid credentials. Will notify the client
 * of the invalid auth attempt. If the number of invalid attempts
 * exceed the threshold specified in options.maxAuthAttempts
 * the client will be notified and the socket destroyed.
 *
 * @param   {Object} authData      the (invalid) auth data
 * @param   {SocketWrapper} socketWrapper
 *
 * @private
 *
 * @returns {void}
 */
ConnectionEndpoint.prototype._processInvalidAuth = function( authError, authData, socketWrapper ) {
	var logMsg = 'invalid authentication data';

	if( this._options.logInvalidAuthData === true ) {
		logMsg += ': ' + JSON.stringify( authData );
	}

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INVALID_AUTH_DATA, logMsg );
	socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.INVALID_AUTH_DATA, authError || 'invalid authentication data' );
	socketWrapper.authAttempts++;
	
	if( socketWrapper.authAttempts >= this._options.maxAuthAttempts ) {
		this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, 'too many authentication attempts' );
		socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, 'too many authentication attempts' );
		socketWrapper.destroy();
	}
};

/**
 * Callback for the results returned by the permissionHandler
 *
 * @param   {Object} authData
 * @param   {SocketWrapper} socketWrapper
 * @param   {String} authError     String or null if auth succesfull
 * @param   {String} username
 *
 * @private
 * 
 * @returns {void}
 */
ConnectionEndpoint.prototype._processAuthResult = function( authData, socketWrapper, authError, username ) {
	if( authError === null ) {
		this._registerAuthenticatedSocket( socketWrapper, username );
	} else {
		this._processInvalidAuth( authError, authData, socketWrapper );
	}
};

ConnectionEndpoint.prototype._onError = function( error ) {
	this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.CONNECTION_ERROR, error );
};

module.exports = ConnectionEndpoint;