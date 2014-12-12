var net = require( 'net' ),
	event = require( 'events' ),
	utils = require( 'util' ),
	TcpSocket = require( './tcp-socket' );

/**
 * A faster, more low level alternative to engineIo when communicating
 * with backend systems
 *
 * @emits connection <TcpSocket>
 * @emits error <errorMessage>
 * 
 * @param {String} host the host the tcp server listens on for incoming connections
 * @param {Number} port the port the tcp server listens on for incoming connections
 *
 * @constructor
 */
var TcpEndpoint = function( options ) {
	this._options = options;
	this._server = net.createServer( {allowHalfOpen: false}, this._onIncomingConnection.bind( this ) );
	this._server.listen( this._options.host, this._options.port );
};

utils.inherits( TcpEndpoint, event.EventEmitter );

TcpEndpoint.prototype._onIncomingConnection = function( socket ) {
	this.emit( 'connection', new TcpSocket( this._options, socket ) );
};

module.exports = TcpEndpoint;