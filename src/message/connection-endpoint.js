var C = require( '../constants/constants' ),
	messageBuilder = require( './message-builder' ),
	messageParser = require( './message-parser' ),
	SocketWrapper = require( './socket-wrapper' ),
	utils = require( 'util' ),
	EventEmitter = require( 'events' ).EventEmitter;

var ConnectionEndpoint = function( engineIo, options ) {
	this._options = options;
	this._endPoint = engineIo;
	this._endPoint.on( 'connection', this._onConnection.bind( this ) );
	this._timeout = null;
	this._msgNum = 0;
	this._authenticatedSockets = [];
};

utils.inherits( ConnectionEndpoint, EventEmitter );

ConnectionEndpoint.prototype._onConnection = function( socket ) {
	var socketWrapper = new SocketWrapper( socket );
	socketWrapper.authCallBack = this._authenticateConnection.bind( this, socketWrapper );
	socket.on( 'message', socketWrapper.authCallBack );
};

ConnectionEndpoint.prototype._authenticateConnection = function( socketWrapper, authMsg ) {
	this._options.logger.log( C.LOG_LEVEL.DEBUG, C.EVENT.AUTH_ATTEMPT, authMsg );

	var msg = messageParser.parse( authMsg )[ 0 ],
		authData,
		errorMsg;

	if( !msg || msg.topic !== C.TOPIC.AUTH || msg.action !== C.ACTIONS.REQUEST || msg.data.length !== 1 ) {
		errorMsg = this._options.logInvalidAuthData === true ? authMsg : '';
		this._sendInvalidAuthMsg( socketWrapper, errorMsg );
		return;
	}

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
	
	this._options.permissionHandler.isValidUser( 
		socketWrapper.getHandshakeData(), 
		authData,
		this._processAuthResult.bind( this, authData, socketWrapper ) 
	);
};

ConnectionEndpoint.prototype._sendInvalidAuthMsg = function( socketWrapper, msg ) {
	this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_AUTH_MSG, msg );
	socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.INVALID_AUTH_MSG, 'invalid authentication message' );
	socketWrapper.destroy();
};

ConnectionEndpoint.prototype._onMessage = function( socket, message ) {
	this.emit( 'message', socket, message );
};

ConnectionEndpoint.prototype._registerAuthenticatedSocket  = function( socketWrapper, userData ) {
	socketWrapper.socket.removeListener( 'message', socketWrapper.authCallBack );
	socketWrapper.socket.on( 'message', this._onMessage.bind( this, socketWrapper ) );
	socketWrapper.user = userData;
	socketWrapper.sendMessage( C.TOPIC.AUTH, C.ACTIONS.ACK );
	this._authenticatedSockets.push( socketWrapper );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.AUTH_SUCCESSFUL, userData );
};

ConnectionEndpoint.prototype._processInvalidAuth = function( authData, socketWrapper ) {
	var logMsg = 'invalid authentication data';

	if( this._options.logInvalidAuthData === true ) {
		logMsg += ': ' + JSON.stringify( authData );
	}

	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INVALID_AUTH_DATA, logMsg );
	socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.INVALID_AUTH_DATA, 'invalid authentication data' );
	socketWrapper.authAttempts++;
	
	if( socketWrapper.authAttempts >= this._options.maxAuthAttempts ) {
		this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, 'too many authentication attempts' );
		socketWrapper.sendError( C.TOPIC.AUTH, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, 'too many authentication attempts' );
		socketWrapper.destroy();
	}
};

ConnectionEndpoint.prototype._processAuthResult = function( authData, socketWrapper, authError, userData ) {
	if( authError === null ) {
		this._registerAuthenticatedSocket( socketWrapper, userData );
	} else {
		this._processInvalidAuth( authData, socketWrapper );
	}
};

module.exports = ConnectionEndpoint;