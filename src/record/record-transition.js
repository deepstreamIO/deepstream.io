var C = require( '../constants/constants' ),
	JsonPath = require( './json-path' ),
	RecordRequest = require( './record-request' ),
	messageParser = require( '../message/message-parser' );

/**
 * This class manages one or more simultanious updates to the data of a record.
 * Now: Why does that need to be so complicated and why does this class even exist?
 *
 * In short: Cross-network concurrency. If your record is written to by a single datasource
 * and consumed by many clients, this class is admittably overkill, but if deepstream is used to
 * build an app that allows many users to collaboratively edit the same dataset, sooner or later
 * two will do so at the same time.
 *
 * Every deepstream record therefor has a version number that's incremented with every change. Every client
 * sends this version number along with the changed data. If no other update had been received for the same version
 * in the meantime the update is accepted and not much more happens.
 *
 * If, however, another clients was able to send its updated version before this update was processed, the second
 * (later) update for the same version number is rejected and the issuing client is notified of the change.
 *
 * The client is then expected to merge its changes on top of the new version and re-issue the update message.
 *
 * Please note: For performance reasons succesful updates are not explicitly acknowledged.
 *
 * It's this class' responsibility to manage this. It will be created when an update arrives and only exist as
 * long as it takes to apply it and make sure that no subsequent updates for the same version are requested.
 *
 * Once the update is applied it will notify the record-handler to broadcast the
 * update and delete the instance of this class.
 */
var RecordTransition = function( name, options, recordHandler ) {
	this._name = name;
	this._options = options;
	this._recordHandler = recordHandler;
	this._steps = [];
	this._record = null;
	this._currentStep = null;
	this._recordRequest = null;
};

RecordTransition.prototype.hasVersion = function( version ) {
	for( var i = 0; i < this._steps.length; i++ ) {
		if( this._steps[ i ].version === version ) {
			return true;
		}
	}

	return false;
};

RecordTransition.prototype.add = function( socketWrapper, version, message ) {
	var data, update = {
		message: message,
		version: version,
		sender: socketWrapper
	};

	if( message.action === C.ACTIONS.UPDATE ) {

		try{
			data = JSON.parse( message.data[ 2 ] );
		} catch( e ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.data[ 2 ] );
			return;
		}

		update.isPatch = false;
		update.data = data;
	}

	if( message.action === C.ACTIONS.PATCH ) {
		update.isPatch = true;
		update.data = messageParser.convertTyped( message.data[ 3 ] );
		update.path = message.data[ 2 ];
	}

	this._steps.push( update );

	if( this._recordRequest === null ) {
		this._recordRequest = new RecordRequest( this._name, this._options, null, this._onRecord.bind( this ) );
	}
};

RecordTransition.prototype._onRecord = function( record ) {
	this._record = record;
	this._next();
};

RecordTransition.prototype._next = function() {

	if( this._steps.length === 0 ) {
		this._destroy();
		return;
	}

	this._currentStep = this._steps.shift();
	this._record._v = this._currentStep.version;

	if( this._currentStep.isPatch ) {
		( new JsonPath( this._currentStep.path ) ).setValue( this._record._d, this._currentStep.data );
	} else {
		this._record._d = this._currentStep.data;
	}

	this._options.cache.set( this._name, this._record, this._onCacheResponse.bind( this ) );
};

RecordTransition.prototype._onCacheResponse = function( error ) {
	if( error ) {
		console.log( error );
		//TODO
	} else {
		this._recordHandler._$broadcastUpdate( this._name, this._currentStep.message, this._currentStep.sender );
		this._next();
	}
};

RecordTransition.prototype._destroy = function() {
	this._recordHandler._$transitionComplete( this._name );
	this._name = null;
	this._options = null;
	this._recordHandler = null;
	this._steps = null;
	this._record = null;
	this._currentStep = null;
	this._recordRequest = null;
};

module.exports = RecordTransition;