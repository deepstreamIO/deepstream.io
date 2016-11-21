var C = require( '../constants/constants' ),
	messageBuilder = require( './message-builder' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' ),
	uws = require( 'uws' );

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 *
 * @param {WebSocket} socket
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
	this.uuid = Math.random();

	this._queuedMessages = [];
	this._currentPacketMessageCount = 0;
	this._sendNextPacketTimeout = null;
	this._currentMessageResetTimeout = null;

	/**
	 * This defaults for test purposes since socket wrapper creating touches
	 * everything
	 */
	if( typeof this._options.maxMessagesPerPacket === "undefined" ) {
		this._options.maxMessagesPerPacket = 1000;
	}
};

utils.inherits( SocketWrapper, EventEmitter );
SocketWrapper.lastPreparedMessage = null;

/**
 * Updates lastPreparedMessage and returns the [uws] prepared message.
 *
 * @param {String} message the message to be prepared
 *
 * @public
 * @returns {External} prepared message
 */
SocketWrapper.prepareMessage = function( message ) {
	SocketWrapper.lastPreparedMessage = message;
	return uws.native.server.prepareMessage( message, uws.OPCODE_TEXT );
}

/**
 * Sends the [uws] prepared message, or in case of testing sends the
 * last prepared message.
 *
 * @param {External} preparedMessage the prepared message
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendPrepared = function(preparedMessage) {
	if ( this.socket.external ) {
		uws.native.server.sendPrepared( this.socket.external, preparedMessage );
	} else if ( this.socket.external !== null ) {
		this.socket.send( SocketWrapper.lastPreparedMessage );
	}
}

/**
 * Variant of send with no particular checks or appends of message.
 *
 * @param {String} message the message to send
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendNative = function( message ) {
	this.socket.send( message );
}

/**
 * Finalizes the [uws] perpared message.
 *
 * @param {External} preparedMessage the prepared message to finalize
 *
 * @public
 * @returns {void}
 */
SocketWrapper.finalizeMessage = function( preparedMessage ) {
	uws.native.server.finalizeMessage( preparedMessage );
}

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
		remoteAddress: this.socket._socket.remoteAddress
	};

	if( this.socket.upgradeReq ) {
		handshakeData.headers = this.socket.upgradeReq.headers;
		handshakeData.referer = this.socket.upgradeReq.headers.referer;
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
		this.send( messageBuilder.getErrorMsg( topic, type, msg ) );
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
		this.send( messageBuilder.getMsg( topic, action, data ) );
	}
};

/**
 * Checks the passed message and appends missing end separator if
 * needed, and then sends this message immediately.
 *
 * @param   {String} message deepstream message
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.send = function( message ) {
	if( message.charAt( message.length - 1 ) !== C.MESSAGE_SEPERATOR ) {
		message += C.MESSAGE_SEPERATOR;
	}

	if( this.isClosed === true ) {
		return;
	}

	this.socket.send( message );
};

/**
 * Destroyes the socket. Removes all deepstream specific
 * logic and closes the connection
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.destroy = function() {
	this.socket.close();
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
	this.emit( 'close' );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.CLIENT_DISCONNECTED, this.user );
};

module.exports = SocketWrapper;
