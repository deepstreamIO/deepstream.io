var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	RecordRequest = require( './record-request' );

var RecordHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( C.TOPIC.RECORD, options );
};

/**
 * Handles incoming record requests.
 *
 * Please not that neither CREATE nor READ is allowed as a
 * client send action. Instead the client sends CREATEORREAD
 * and deepstream works out the rest
 *
 * @param   {[type]} socketWrapper [description]
 * @param   {[type]} message       [description]
 *
 * @returns {[type]}               [description]
 */
RecordHandler.prototype.handle = function( socketWrapper, message ) {

	if( !message.data || message.data.length < 1 ) {
		socket.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	if( message.action === C.ACTIONS.CREATEORREAD ) {
		this._createOrRead( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UPDATE ) {
		this._update( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.DELETE ) {
		this._delete( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._unsubscribe( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.LISTEN ) {
		this._listen( socketWrapper, message );
	}

	else {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
		
		if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
		}
	}
};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._createOrRead = function( socketWrapper, message ) {
	var recordName = message.data[ 0 ],
		onComplete = function( record ) {
			if( record ) {
				this._read( record, socketWrapper );
			} else {
				this._create( recordName, socketWrapper );
			}
		};
	
	new RecordRequest( recordName, this._options, socketWrapper, onComplete );
};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._create = function( recordName, socketWrapper ) {

};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._read = function( record, socketWrapper, message ) {

};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._update = function( socketWrapper, message ) {

};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._delete = function( socketWrapper, message ) {

};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._subscribe = function( socketWrapper, message ) {

};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._unsubscribe = function( socketWrapper, message ) {

};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._listen = function( socketWrapper, message ) {

};

module.exports = RecordHandler;