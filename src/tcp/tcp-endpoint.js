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
 * 
 * @param {Object} options deepstream options
 * @param {Function} readyCallback will be invoked once the server is listening
 *
 * @constructor
 */
var TcpEndpoint = function( options, readyCallback ) {
	this._options = options;
	this._server = net.createServer( {allowHalfOpen: false}, this._onIncomingConnection.bind( this ) );
	this._server.listen( this._options.tcpPort, this._options.tcpHost, readyCallback );
	this._server.on( 'error', this._onError.bind( this ) );
};

utils.inherits( TcpEndpoint, event.EventEmitter );

/**
 * Callback for incoming connections. Creates an
 * instance of TcpSocket that wraps the native net.Socket
 * and emits a connection event.
 *
 * @param   {net.Socket} socket The original node socket instance
 *
 * @emits {TcpSocket} connection
 *
 * @private
 * @returns {void}
 */
TcpEndpoint.prototype._onIncomingConnection = function( socket ) {
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

module.exports = TcpEndpoint;
