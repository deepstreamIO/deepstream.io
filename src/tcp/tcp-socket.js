var events = require( 'events' ),
	util = require( 'util' ),
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
	this._socket.on( 'end', this._onDisconnect.bind( this ) );
	this._socket.on( 'data', this._onData.bind( this ) );

	this.headers = null;
	this.url = socket.remoteAddress + ':' + socket.remotePort;
	this.method = null;
	this.httpVersionMajor = null;
	this.httpVersionMinor = null;

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
		this.socket.write( message, 'utf8' );
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
 * @param   {String} message
 *
 * @emits 	{String} message
 *
 * @private
 * @returns {void}
 */
TcpSocket.prototype._onData = function( message ) {
	var errorMsg;

	if( this._isClosed === true ) {
		errorMsg = 'Received data on a half closed socket: ' + message;
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.CLOSED_SOCKET_INTERACTION, errorMsg );
		return;
	}

	if( typeof message !== 'string' ) {
		errorMsg = 'Received non-string message from socket';
		//TODO use different event
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.CLOSED_SOCKET_INTERACTION, errorMsg );
		return;
	}

	this.emit( 'message', message );
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
	this.emit( 'close' );
	this._isClosed = true;
};

module.exports = TcpSocket;
