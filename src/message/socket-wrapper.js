var C = require( '../constants/constants' ),
	messageBuilder = require( './message-builder' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );

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
 * Main method for sending messages. Doesn't send messages instantly,
 * but instead achieves conflation by adding them to the message
 * buffer that will be drained on the next tick
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

	this._queuedMessages.push( message );
	this._currentPacketMessageCount++;

	if( this._currentMessageResetTimeout === null ) {
		this._currentMessageResetTimeout = process.nextTick( this._resetCurrentMessageCount.bind( this ) );
	}

	if( this._queuedMessages.length < this._options.maxMessagesPerPacket &&
		this._currentPacketMessageCount < this._options.maxMessagesPerPacket ) {
		this._sendQueuedMessages();
	}
	else if( this._sendNextPacketTimeout === null ) {
		this._queueNextPacket();
	}
};

/**
 * When the implementation tries to send a large
 * number of messages in one execution thread, the first
 * <maxMessagesPerPacket> are send straight away.
 *
 * _currentPacketMessageCount keeps track of how many messages
 * went into that first packet. Once this number has been exceeded
 * the remaining messages are written to a queue and this message
 * is invoked on a timeout to reset the count.
 *
 * @private
 * @returns {void}
 */
SocketWrapper.prototype._resetCurrentMessageCount = function() {
	this._currentPacketMessageCount = 0;
	this._currentMessageResetTimeout = null;
};

/**
 * Concatenates the messages in the current message queue
 * and sends them as a single package. This will also
 * empty the message queue and conclude the send process.
 *
 * @private
 * @returns {void}
 */
SocketWrapper.prototype._sendQueuedMessages = function() {

	if( this._queuedMessages.length === 0 ) {
		this._sendNextPacketTimeout = null;
		return;
	}

	var message = this._queuedMessages.splice( 0, this._options.maxMessagesPerPacket ).join( '' );

	if( this._queuedMessages.length !== 0 ) {
		this._queueNextPacket();
	} else {
		this._sendNextPacketTimeout = null;
	}

    if( this.isClosed === false ) {
        this.socket.send( message );
    }
};

/**
 * Schedules the next packet whilst the connection is under
 * heavy load.
 *
 * @private
 * @returns {void}
 */
SocketWrapper.prototype._queueNextPacket = function() {
	var fn = this._sendQueuedMessages.bind( this ),
		delay = this._options.timeBetweenSendingQueuedPackages;
	this._sendNextPacketTimeout = setTimeout( fn, delay );
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
