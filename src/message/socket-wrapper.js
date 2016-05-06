var C = require( '../constants/constants' ),
	messageBuilder = require( './message-builder' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );

/**
 * This class wraps around an engine.io or TCP socket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 *
 * @param {engine.io Socket | TcpSocket} socket
 * @param {Object} options
 *
 * @extends EventEmitter
 *
 * @constructor
 */
var SocketWrapper = function( socket, options ) {
	this.socket = socket;
	this.isClosed = false;
	this.socket.once( 'close', this._onSocketClose.bind( this ) );
	this._options = options;
	this.user = null;
	this.authCallBack = null;
	this.authAttempts = 0;
	this.setMaxListeners( 0 );
};

utils.inherits( SocketWrapper, EventEmitter );

/**
 * Returns a map of parameters that were collected
 * during the initial http request that established the
 * connection
 *
 * @public
 * @returns {Object} handshakeData
 */
SocketWrapper.prototype.getHandshakeData = function() {
	var handshakeData = {
		remoteAddress: this.socket.remoteAddress
	};

	if( this.socket.request ) {
		handshakeData.headers = this.socket.request.headers;
		handshakeData.referer = this.socket.request.headers.referer;
	}

	return handshakeData;
};

/**
 * Sends an error on the specified topic. The
 * action will automatically be set to C.ACTION.ERROR
 *
 * @param {String} topic one of C.TOPIC
 * @param {String} type one of C.EVENT
 * @param {String} msg generic error message
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendError = function( topic, type, msg ) {
	if( this.isClosed === false ) {
		this.socket.send( messageBuilder.getErrorMsg( topic, type, msg ) );
	}
};

/**
 * Sends a message based on the provided action and topic
 *
 * @param {String} topic one of C.TOPIC
 * @param {String} action one of C.ACTIONS
 * @param {Array} data Array of strings or JSON-serializable objects
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendMessage = function( topic, action, data ) {
	if( this.isClosed === false ) {
		this.socket.send( messageBuilder.getMsg( topic, action, data ) );
	}
};

/**
 * Low level send method. Sends a string to the client
 *
 * @param {String} msg deepstream message string
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.send = function( msg ) {
	if( msg.charAt( msg.length - 1 ) !== C.MESSAGE_SEPERATOR ) {
		msg += C.MESSAGE_SEPERATOR;
	}

	if( this.isClosed === false ) {
		this.socket.send( msg );
	}
};

/**
 * Destroyes the socket. Removes all deepstream specific
 * logic and closes the connection
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.destroy = function() {
	this.socket.close( true );
	this.socket.removeAllListeners();
	this.authCallBack = null;
};

/**
 * Callback for closed sockets
 *
 * @private
 * @returns {void}
 */
SocketWrapper.prototype._onSocketClose = function() {
	this.isClosed = true;
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.CLIENT_DISCONNECTED, this.user );
};

module.exports = SocketWrapper;