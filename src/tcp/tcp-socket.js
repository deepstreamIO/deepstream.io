var events = require( 'events' ),
	util = require( 'util' ),
	messageBuilder = require( '../message/message-builder' ),
	C = require( '../constants/constants' );

/**
 * This class implements the same interface as the engine.io
 * socket, but for the net.Socket TCP socket
 *
 * @emits message {String} message
 * @emits close
 *
 * @param {net.Socket} socket
 *
 * @constructor
 */
var TcpSocket = function( options, socket ) {
	this._options = options;
	this._socket = socket;
	this._socket.setEncoding( 'utf8' );
	this._socket.setNoDelay( true );
	this._socket.setKeepAlive( true, 5000 );
	this._socket.on( 'error', this._onError.bind( this ) );
	this._socket.on( 'end', this._onDisconnect.bind( this ) );
	this._socket.on( 'data', this._onData.bind( this ) );
	this._messageBuffer = '';
	this.remoteAddress = socket.remoteAddress + ':' + socket.remotePort;
	this._isClosed = false;
};

util.inherits( TcpSocket, events.EventEmitter );

/**
 * Sends a message over the socket. Please note: deepstream.io already
 * takes care of conflation, so there's no additional need for the socket to buffer chuncks
 * and conflate them into larger messages (See http://en.wikipedia.org/wiki/Nagle%27s_algorithm)
 *
 * Instead the message is send straight away.
 *
 * @param   {String} message
 *
 * @public
 * @returns {void}
 */
TcpSocket.prototype.send = function( message ) {
	if( this._isClosed === true ) {
		var errorMsg = 'Attempt to send message on closed socket: ' + message;
		this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.CLOSED_SOCKET_INTERACTION, errorMsg );
	}
	else {
		this._socket.write( message, 'utf8' );
	}
};

/**
 * Sends a FIN package over the socket. Please note, this gracefully closes
 * the socket, rather than destroying it. It is therefor possible to receive
 * messages that were already on their way after close is called. The _onData method
 * therefor checks if the socket was closed before forwarding the received data
 *
 * @public
 * @returns {void}
 */
TcpSocket.prototype.close = function() {
	this._isClosed = true;
	this._socket.end();
};

/**
 * Callback for incoming data on the socket
 *
 * @param   {String} packet
 *
 * @emits 	{String} message
 *
 * @private
 * @returns {void}
 */
TcpSocket.prototype._onData = function( packet ) {
	var errorMsg, message;

	if( this._isClosed === true ) {
		errorMsg = 'Received data on a half closed socket: ' + packet;
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.CLOSED_SOCKET_INTERACTION, errorMsg );
		return;
	}

	if( typeof packet !== 'string' ) {
		errorMsg = 'Received non-string message from socket';
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE, errorMsg );
		return;
	}

	if( packet.charAt( packet.length - 1 ) !== C.MESSAGE_SEPERATOR ) {

		this._messageBuffer += packet;

		if( this._messageBuffer.length >= this._options.maxMessageSize ) {
			this._maxMessageSizeExceed();
		}

		return;
	}

	if( this._messageBuffer.length !== 0 ) {
		message = this._messageBuffer + packet;
		this._messageBuffer = '';
	} else {
		message = packet;
	}

	this.emit( 'message', message );
};

/**
 * When the message recieved is greater than the maximum allowed amount specified
 * va maxMessageSize this will remove the preceding valid messages in the buffer
 * or dump the buffer and emit a MAXIMUM_MESSAGE_SIZE_EXCEEDED event.
 *
 *
 * @emits 	{String} message
 *
 * @private
 * @returns {void}
 */
TcpSocket.prototype._maxMessageSizeExceed = function() {
	var errorMsg, indexEOM;

	indexEOM = this._messageBuffer.lastIndexOf( C.MESSAGE_SEPERATOR );
	if(  indexEOM === -1 ) {
		errorMsg = 'Received message longer than maxMessageSize';
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.MAXIMUM_MESSAGE_SIZE_EXCEEDED, errorMsg );
		this.send( messageBuilder.getErrorMsg( C.TOPIC.ERROR, C.EVENT.MAXIMUM_MESSAGE_SIZE_EXCEEDED, errorMsg ) );
		this._messageBuffer = '';
	} else {
		message = this._messageBuffer.substring( 0, indexEOM + 1 );
		this._messageBuffer = this._messageBuffer.substring( indexEOM + 1 );
		this.emit( 'message', message );
	}
};

/**
 * Callback for the socket's close event, whether triggered intentionally
 * or erroneous
 *
 * @emits close
 *
 * @private
 * @returns {void}
 */
TcpSocket.prototype._onDisconnect = function() {
	if( this._isDisconnected === true ) {
		return;
	}

	this.emit( 'close' );
	this._isClosed = true;
	this._isDisconnected = true;
};

/**
 * Callback for socket errors
 *
 * @param {String} error
 *
 * @private
 * @returns {void}
 */
TcpSocket.prototype._onError = function( error ) {
	this._onDisconnect();
};

module.exports = TcpSocket;
