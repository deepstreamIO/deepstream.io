var net = require( 'net' ),
	event = require( 'events' ),
	utils = require( 'util' ),
	TcpSocket = require( './tcp-socket' ),
	C = require( '../constants/constants' );

/**
 * A faster, more low level alternative to engine.io when communicating
 * with backend systems
 *
 * @emits connection <TcpSocket>
 * @emits error <errorMessage>
 * @emits close
 * 
 * @param {Object} options deepstream options
 * @param {Function} readyCallback will be invoked once the server is listening
 *
 * @constructor
 */
var TcpEndpoint = function( options, readyCallback ) {
	this.isClosed = false;
	
	this._options = options;
	this._readyCallback = readyCallback;
	this._sockets = [];
	this._server = net.createServer( {allowHalfOpen: false}, this._onIncomingConnection.bind( this ) );
	this._server.listen( this._options.tcpPort, this._options.tcpHost, this._onOpen.bind( this ) );
	this._server.on( 'error', this._onError.bind( this ) );
	this._server.once( 'close', this._onClose.bind( this ) );
};

utils.inherits( TcpEndpoint, event.EventEmitter );

/**
 * Closes the tcp server and removes all connections. The actual close
 * event of the TcpEndpoint will be emitted once the tcp server emits close
 * 
 * @public
 * @returns {void}
 */
TcpEndpoint.prototype.close = function() {
	this._server.close();
	
	for( var i = 0; i < this._sockets.length; i++ ) {
		this._sockets[ i ].destroy();
	}
};

/**
 * Removes a closed socket from the array of sockets
 * 
 * @param {net.Socket} socket
 * 
 * @private
 * @returns {void}
 */
TcpEndpoint.prototype._removeSocket = function( socket ) {
	var index = this._sockets.indexOf( socket );
	
	if( index !== -1 ) {
		this._sockets.splice( index, 1 );
	}
};

/**
 * Callback for incoming connections. Creates an
 * instance of TcpSocket that wraps the native net.Socket
 * and emits a connection event.
 *
 * @param {net.Socket} socket The original node socket instance
 *
 * @emits {TcpSocket} connection
 *
 * @private
 * @returns {void}
 */
TcpEndpoint.prototype._onIncomingConnection = function( socket ) {
	socket.once( 'close', this._removeSocket.bind( this, socket ) );
	this._sockets.push( socket );
	this.emit( 'connection', new TcpSocket( this._options, socket ) );
};

/**
 * Callbacks for errors emitted by the server. Errors emitted by the
 * sockets are directly handled by the TcpSocket class
 *
 * @param   {String} error
 * @emits	{String} error
 * 
 * @private
 * @returns {void}
 */
TcpEndpoint.prototype._onError = function( error ) {
	this.emit( 'error', error.toString() );
};

/**
 * Callback for the tcp server's close event. The server will
 * only emit close once itself and all connected sockets are
 * closed
 * 
 * @private
 * @returns {void}
 */
TcpEndpoint.prototype._onClose = function() {
	this.isClosed = true;
	this.emit( 'close' );
};

/**
 * Callback for the tcp server's open event.
 *
 * @private
 * @returns {void}
 */
TcpEndpoint.prototype._onOpen = function() {
	this.isClosed = false;
	this._readyCallback();
};

module.exports = TcpEndpoint;
