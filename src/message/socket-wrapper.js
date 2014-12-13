var messageBuilder = require( './message-builder' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' ); 

/**
 * This class wraps around an engine.io socket
 * and provides higher level methods that are integrated
 * with deepstreams message structure
 * 
 * @param {engine.io Socket} socket
 * @extends EventEmitter
 * 
 * @constructor
 */
var SocketWrapper = function( socket ) {
	this.socket = socket;
	this.user = null;
	this.authCallBack = null;
	this.authAttempts = 0;
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
	return {
		headers: this.socket.headers,
		url: this.socket.url,
		method: this.socket.method,
		httpVersionMajor: this.socket.httpVersionMajor,
		httpVersionMinor: this.socket.httpVersionMinor
	};
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
	this.socket.send( messageBuilder.getErrorMsg( topic, type, msg ) );
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
	this.socket.send( messageBuilder.getMsg( topic, action, data ) );
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
	this.socket.send( msg );
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

module.exports = SocketWrapper;