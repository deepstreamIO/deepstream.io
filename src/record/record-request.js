var C = require( '../constants/constants' );

var RecordRequest = function( recordName, options, socketWrapper, onComplete ) {
	this._recordName = recordName;
	this._options = options;
	this._socketWrapper = socketWrapper;
	this._storageRetrievalTimeout = null;
	this._onComplete = onComplete;

	this._cacheRetrievalTimeout = setTimeout( 
		this._sendError.bind( this, C.EVENT.CACHE_RETRIEVAL_TIMEOUT, this._recordName ), 
		this._options.cacheRetrievalTimeout
	);

	this._options.cache.get( this._recordName, this._onCacheResponse.bind( this ) );
};


RecordRequest.prototype._onCacheResponse = function( error, record ) {
	clearTimeout( this._cacheRetrievalTimeout );

	if( error ) {
		this._sendError( C.EVENT.RECORD_LOAD_ERROR, 'error while loading ' + this._recordName + ' from cache' );
	}
	else if( record ) {
		this._onComplete( record );
	}
	else {
		this._storageRetrievalTimeout = setTimeout( 
			this._sendError.bind( this, C.EVENT.STORAGE_RETRIEVAL_TIMEOUT, this._recordName ), 
			this._options.storageRetrievalTimeout
		);

		this._options.storage.get( this._recordName, this._onStorageResponse.bind( this ) );
	}
};

RecordRequest.prototype._onStorageResponse = function( error, record ) {
	clearTimeout( this._storageRetrievalTimeout );

	if( error ) {
		this._sendError( C.EVENT.RECORD_LOAD_ERROR, 'error while loading ' + this._recordName + ' from storage' );
	} else {
		this._onComplete( record || null );
	}
};

RecordRequest.prototype._sendError = function( event, message ) {
	this._options.logger.log( C.LOG_LEVEL.ERROR, event, message );
	this._socketWrapper.sendError( C.TOPIC.RECORD, event, message );
};

module.exports = RecordRequest;