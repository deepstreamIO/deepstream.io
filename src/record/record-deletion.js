var messageBuilder = require( '../message/message-builder' ),
	C = require( '../constants/constants' );

/**
 * This class represents the deletion of a single record. It handles it's removal
 * from cache and storage and handles errors and timeouts 
 *
 * @param {Object} 			options       		deepstream options
 * @param {SocketWrapper} 	socketWrapper 		the sender of the delete message
 * @param {Object} 			message       		parsed and validated deletion message
 * @param {Function} 		successCallback 	callback for succesful deletions
 *
 * @constructor
 */
var RecordDeletion = function( options, socketWrapper, message, successCallback ) {
	this._options = options;
	this._socketWrapper = socketWrapper;
	this._message = message;
	this._successCallback = successCallback;
	this._recordName = message.data[ 0 ];
	this._completed = 0;
	this._isDestroyed = false;

	this._cacheTimeout = setTimeout( this._handleError.bind( this, 'cache timeout' ), this._options.cacheRetrievalTimeout );
	this._options.cache.delete( this._recordName, this._checkIfDone.bind( this, this._cacheTimeout ) );

	if( !this._options.storageExclusion || !this._options.storageExclusion.test( this._recordName ) ) {
		this._storageTimeout = setTimeout( this._handleError.bind( this, 'storage timeout' ), this._options.storageRetrievalTimeout );
		this._options.storage.delete(this._recordName, this._checkIfDone.bind( this, this._storageTimeout ) );
	} else {
		this._checkIfDone( null );
	}
};

/**
 * Callback for completed cache and storage interactions. Will invoke
 * _done() once both are completed
 *
 * @param   {String} error     Error message or null
 * @param   {Number} timeoutId The id of the timeout that was associated with the request
 *
 * @returns {void}
 */
RecordDeletion.prototype._checkIfDone = function( timeoutId, error ) {
	clearTimeout( timeoutId );
	this._completed++;

	if( this._isDestroyed ) {
		return;
	}

	if( error ) {
		this._handleError( error.toString() );
		return;
	}

	if( this._completed === 2 ) {
		this._done();
	}
};

/**
 * Callback for successful deletions. Notifies the original sender and calls
 * the callback to allow the recordHandler to broadcast the deletion
 *
 * @private
 * @returns {void}
 */
RecordDeletion.prototype._done = function() {
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.RECORD_DELETION, this._recordName );

	var ackMessage = {
		topic: C.TOPIC.RECORD,
		action: C.ACTIONS.ACK,
		data: [ C.ACTIONS.DELETE, this._recordName ],
		raw: messageBuilder.getMsg( C.TOPIC.RECORD, C.ACTIONS.ACK, [ C.ACTIONS.DELETE, this._recordName ] )
	};

	this._socketWrapper.send( ackMessage.raw );
	this._successCallback( this._recordName, ackMessage, this._socketWrapper );
	this._destroy();
};

/**
 * Destroyes the class and null down its dependencies
 *
 * @private
 * @returns {void}
 */
RecordDeletion.prototype._destroy = function() {
	clearTimeout( this._cacheTimeout );
	clearTimeout( this._storageTimeout );
	this._options = null;
	this._socketWrapper = null;
	this._message = null;
	this._isDestroyed = true;
};

/**
 * Handle errors that occured during deleting the record
 *
 * @param   {String} errorMsg
 *
 * @private
 * @returns {void}
 */
RecordDeletion.prototype._handleError = function( errorMsg ) {
	this._socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.RECORD_DELETE_ERROR, errorMsg );
	this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_DELETE_ERROR, errorMsg );
	this._destroy();
};

module.exports = RecordDeletion;