var events = require( 'events' ),
	util = require( 'util' ),
	C = require( '../constants/constants' );

/**
 * This class implements the same interface as the engine.io
 * socket for the net.Socket TCP socket
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

TcpSocket.prototype.send = function( message ) {
	if( this._isClosed === true ) {
		var errorMsg = 'Attempt to send message on closed socket: ' + message;
		this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.CLOSED_SOCKET_INTERACTION, errorMsg );
	}
	else {
		this.socket.write( message, 'utf8' );
	}
};

TcpSocket.prototype.close = function( message ) {
	this._isClosed = true;
	this._socket.end();
};

TcpSocket.prototype._onData = function( message ) {
	if( this._isClosed === true ) {
		var errorMsg = 'Received data on half closed socket' + message;
		this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.CLOSED_SOCKET_INTERACTION, errorMsg );
	}

	this.emit( 'message', message );
};

TcpSocket.prototype._onDisconnect = function() {
	this.emit( 'close' );
	this._isClosed = true;
};

module.exports = TcpSocket;