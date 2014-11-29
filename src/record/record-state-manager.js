var C = require( '../constants/constants' ),
	RecordRequest = require( './record-request' );

var RecordStateManager = function( options ) {
	this._options = options;
};

RecordStateManager.prototype.update = function( recordName, revisionNumber, minifiedPatch, socketWrapper ) {
	new RecordRequest( recordName, this._options, socketWrapper, this._onRecord.bind( this ) );
};
module.exports = RecordStateManager;