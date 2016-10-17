var C = require( '../constants/constants' ),
	RecordRequest = require( './record-request' ),
	messageParser = require( '../message/message-parser' );

/**
 * This class manages one or more simultanious updates to the data of a record.
 * But: Why does that need to be so complicated and why does this class even exist?
 *
 * In short: Cross-network concurrency. If your record is written to by a single datasource
 * and consumed by many clients, this class is admittably overkill, but if deepstream is used to
 * build an app that allows many users to collaboratively edit the same dataset, sooner or later
 * two of them will do so at the same time and clash.
 *
 * Every deepstream record therefor has a version number that's incremented with every change. Every client
 * sends this version number along with the changed data. If no other update has been received for the same version
 * in the meantime, the update is accepted and not much more happens.
 *
 * If, however, another clients was able to send its updated version before this update was processed, the second
 * (later) update for the same version number is rejected and the issuing client is notified of the change.
 *
 * The client is then expected to merge its changes on top of the new version and re-issue the update message.
 *
 * Please note: For performance reasons, succesful updates are not explicitly acknowledged.
 *
 * It's this class' responsibility to manage this. It will be created when an update arrives and only exist as
 * long as it takes to apply it and make sure that no subsequent updates for the same version are requested.
 *
 * Once the update is applied it will notify the record-handler to broadcast the
 * update and delete the instance of this class.
 *
 * @param {String} name the name of the record that the transition will be applied to
 * @param {Object} deepstream options
 * @param {RecordHandler} recordHandler the instance of recordHandler that created this transition
 *
 * @constructor
 */
var RecordTransition = function( name, options, recordHandler ) {
	this._name = name;
	this._options = options;
	this._recordHandler = recordHandler;
	this._steps = [];
	this._record = null;
	this._currentStep = null;
	this._recordRequest = null;
	this.isDestroyed = false;
};

/**
 * Adds a new step (update) to the record. The step
 * will be queued or executed immediatly if the queue is empty
 *
 * This method will also retrieve the current record's data when called
 * for the first time
 *
 * @param {SocketWrapper} socketWrapper that send the message
 * @param {Number} version the expected version that this update will apply
 * @param {Object} message parsed deepstream message. Data will still be stringified JSON
 *
 * @public
 * @returns {void}
 */
RecordTransition.prototype.add = function( socketWrapper, version, message ) {
	var	update = {
		message: message,
		version: version,
		sender: socketWrapper
	};

	if( message.action !== C.ACTIONS.UPDATE ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	if( message.data.length !== 3 ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	try {
		update.data = JSON.parse( message.data[ 2 ] );
	} catch( error ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	this._steps.push( update );

	if( this._recordRequest === null ) {
		this._recordRequest = new RecordRequest(
			this._name,
			this._options,
			socketWrapper,
			this._onRecord.bind( this ),
			this._onError.bind( this )
		);
	}
};

/**
 * Destroys the instance
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._destroy = function() {
	this._recordHandler._$transitionComplete( this._name );
	this.isDestroyed = true;
	this._name = null;
	this._options = null;
	this._recordHandler = null;
	this._steps = null;
	this._record = null;
	this._currentStep = null;
	this._recordRequest = null;
};

/**
 * Callback for successfully retrieved records
 *
 * @param   {Object} record
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onRecord = function( record ) {
	if( !record ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.RECORD_UPDATE_ERROR, 'Received update for non-existant record ' + this._name );
	}
	this._record = record;
	this._next();
};

/**
 * Callback for failed record retrieval
 *
 * @param   {String} errorMessage
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onError = function( errorMessage ) {
	this._next();
};

/**
 * Once the record is loaded this method is called recoursively
 * for every step in the queue of pending updates.
 *
 * It will apply every update and - once done - either
 * call itself to process the next one or destroy the RecordTransition
 * of the queue has been drained
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._next = function() {
	if( this._steps.length === 0 ) {
		this._destroy();
		return;
	}

	this._currentStep = this._steps.shift();

	var record = {
		_v: this._currentStep.version,
		_d: this._currentStep.data
	};

	if ( this._currentStep.sender !== C.SOURCE_STORAGE_CONNECTOR ) {
		this._options.storage.set( this._name, record, this._onStorageResponse.bind( this ) );
	}

	// On failed record retrieval broadcast a potentially outdated record but don't write to cache
	if ( !this._record ) {
		this._onUpdated();
		return;
	}

	if ( record._v < this._record._v ) {
		this._next();
		return;
	}

	this._options.cache.set( this._name, record, this._onUpdated.bind( this ) );

	this._record = record;
};

/**
 * Callback for responses returned by cache.set(). If an error
 * is returned the queue will be destroyed, otherwise
 * the update will be broadcast to other subscribers and the
 * next step invoked
 *
 * @param   {String} error
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onUpdated = function( error ) {
	if( error ) {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.RECORD_UPDATE_ERROR, errorMessage );
	}
	this._recordHandler._$broadcastUpdate( this._name, this._currentStep.message, this._currentStep.sender );
	this._next();
};

/**
 * Callback for responses returned by storage.set()
 *
 * @param   {String} error
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onStorageResponse = function( error ) {
	if( error && !this.isDestroyed ) {
		this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, error );
	}
};

module.exports = RecordTransition;
