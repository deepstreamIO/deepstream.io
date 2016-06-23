var C = require( '../constants/constants' ),
	JsonPath = require( './json-path' ),
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
	this._sendVersionExists = [];
	this.isDestroyed = false;
};

/**
 * Checks if a specific version number is already processed or
 * queued for processing
 *
 * @param   {Number}  version
 *
 * @returns {Boolean} hasVersion
 */
RecordTransition.prototype.hasVersion = function( version ) {
	var maxVersion = 0;

	for( var i = 0; i < this._steps.length; i++ ) {
		if( this._steps[ i ].version > maxVersion ) {
			maxVersion = this._steps[ i ].version;
		}
	}

	return version <= maxVersion;
};

/**
 * Send version exists error if the record has been already loaded, else
 * store the version exists error to send to the sockerWrapper once the 
 * record is loaded
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Number} version The version number
 *
 * @public
 */
RecordTransition.prototype.sendVersionExists = function( socketWrapper, version ) {
	var i, msg, conflict;

	if( this._record ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.VERSION_EXISTS, [ this._name, this._record._v, JSON.stringify( this._record._d ) ] );
		msg = socketWrapper.user + ' tried to update record ' + this._name + ' to version ' +  version + ' but it already was ' + this._record._v;
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.VERSION_EXISTS, msg );
	} else {
		this._sendVersionExists.push( {
			version: version,
			socketWrapper: socketWrapper
		} );
	}
};

/**
 * Adds a new step (either an update or a patch) to the record. The step
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
	var data,
		update = {
			message: message,
			version: version,
			sender: socketWrapper
		};

	if( message.action === C.ACTIONS.UPDATE ) {
		if( message.data.length !== 3 ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
			return;
		}

		try{
			data = JSON.parse( message.data[ 2 ] );
		} catch( e ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
			return;
		}

		update.isPatch = false;
		update.data = data;
	}

	if( message.action === C.ACTIONS.PATCH ) {
		if( message.data.length !== 4 ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
			return;
		}
		update.isPatch = true;
		update.data = messageParser.convertTyped( message.data[ 3 ] );

		if( update.data instanceof Error ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, update.data.toString() + ':' + message.data[ 3 ] );
			return;
		}

		update.path = message.data[ 2 ];
	}

	this._steps.push( update );

	if( this._recordRequest === null ) {
		this._recordRequest = new RecordRequest(
			this._name,
			this._options,
			socketWrapper,
			this._onRecord.bind( this ),
			this._onFatalError.bind( this )
		);
	}
};

/**
 * Destroys the instance
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype.destroy = function() {
	if( this.isDestroyed ) {
		return;
	}
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
	if( record === null ) {
		this._onFatalError( 'Received update for non-existant record ' + this._name );
	} else {
		this._record = record;
		this._flushVersionExists();
		this._next();
	}
};

/**
 * Once the record is loaded this method is called recoursively
 * for every step in the queue of pending updates.
 *
 * It will apply every patch or update and - once done - either
 * call itself to process the next one or destroy the RecordTransition
 * of the queue has been drained
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._next = function() {
	if( this.isDestroyed === true ) {
		return;
	}

	if( this._steps.length === 0 ) {
		this.destroy();
		return;
	}

	this._currentStep = this._steps.shift();

	if( this._record._v !== this._currentStep.version - 1 ) {
		this.sendVersionExists(  this._currentStep.sender, this._currentStep.version );
		this._next();
		return;
	}

	this._record._v = this._currentStep.version;

	if( this._currentStep.isPatch ) {
		( new JsonPath( this._currentStep.path ) ).setValue( this._record._d, this._currentStep.data );
	} else {
		this._record._d = this._currentStep.data;
	}

	/*
	 * Please note: saving to storage is called first to allow for synchronous cache
	 * responses to destroy the transition, it is however not on the critical path
	 * and the transition will continue straight away, rather than wait for the storage response
	 * to be returned.
	 */
	if( !this._options.storageExclusion || !this._options.storageExclusion.test( this._name ) ) {
		this._options.storage.set( this._name, this._record, this._onStorageResponse.bind( this ) );
	}

	this._options.cache.set( this._name, this._record, this._onCacheResponse.bind( this ) );
};

/**
 * Send all the stored version exists errors once the record has been loaded.
 *
 * @private
 */
RecordTransition.prototype._flushVersionExists = function() {
	var i, conflict;

	for( i=0; i < this._sendVersionExists.length; i++ ) {
		conflict = this._sendVersionExists[ i ];
		this.sendVersionExists( conflict.socketWrapper, conflict.version );
	}

	this._sendVersionExists = [];
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
RecordTransition.prototype._onCacheResponse = function( error ) {
	if( error ) {
		this._onFatalError( error );
	} else if( this.isDestroyed === false ) {
		this._recordHandler._$broadcastUpdate( this._name, this._currentStep.message, this._currentStep.sender );
		this._next();
	}
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
	if( error && this.isDestroyed === false ) {
		this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, error );
	}
};

/**
 * Generic error callback. Will destroy the queue and notify the senders of all pending
 * transitions
 *
 * @param   {String} errorMessage
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onFatalError = function( errorMessage ) {

	if( this.isDestroyed === true ) {
		/* istanbul ignore next */
		return;
	}

	this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, errorMessage );

	for( var i = 0; i < this._steps.length; i++ ) {
		if( this._steps[ i ].sender !== C.SOURCE_MESSAGE_CONNECTOR ) {
			this._steps[ i ].sender.sendError( C.TOPIC.RECORD, C.EVENT.RECORD_UPDATE_ERROR, this._steps[ i ].version );
		}
	}

	this.destroy();
};

module.exports = RecordTransition;