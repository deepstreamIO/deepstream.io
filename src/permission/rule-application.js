var OPEN = 'open';
var UNDEFINED = 'undefined';
var LOADING = 'loading';

var C = require( '../constants/constants' );
var RecordRequest = require( '../record/record-request' );
var messageParser = require( '../message/message-parser' );


var RuleApplication = function( params ) {
	this._params = params;
	this._isLoading = false;
	this._crossReferenceFn = this._crossReference.bind( this );
	this._pathVars = this._getPathVars();
	this._user = this._getUser();
	this._recordData = {};
	this._run();
};

RuleApplication.prototype._run = function() {
	var args = this._getArguments();
	var result;
	if( this._isLoading === true ) {
		return;
	}

	try{
		result = this._params.rule.fn.apply( {}, args );
	}catch( error ) {
		this._params.callback( error.toString(), false );
		var errorMsg = 'error when executing function ' + this._params.rule.fn.toString() + ' :' + error.toString();
		this._params.options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.PERMISSION_ERROR, errorMsg );
		this._destroy();
		return;
	}

	if( this._isLoading === false ) {
		this._params.callback( null, result );
		this._destroy();
	}
};

RuleApplication.prototype._onLoadComplete = function( recordName, data ) {
	this._recordData[ recordName ] = data;
	this._isLoading = false;
	this._run();
};

RuleApplication.prototype._onLoadError = function( error ) {
	var errorMsg = 'failed to load record ' + this._params.name + ' for permissioning:' + error.toString();
	this._params.options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, errorMsg );
	this._isLoading = false;
	this._params.callback( error.toString(), false );
	this._destroy();
};

RuleApplication.prototype._destroy = function() {
	this._isDestroyed = true;
	this._isLoading = false;
	this._params = null;
	this._crossReferenceFn = null;
	this._pathVars = null;
	this._user = null;
	this._recordData = null;
	this._currentData = null;
};

/**
 * data is supported for record read & write, event publish and rpc request
 *
 * @returns {[type]}
 */
RuleApplication.prototype._getCurrentData = function() {
	if( this._params.rule.hasData === false ) {
		return null;
	}

	var msg = this._params.message;

	if( msg.topic === C.TOPIC.EVENT ) {
		return messageParser.convertTyped( msg.data[ 1 ] );
	}

	if( msg.topic === C.TOPIC.RPC ) {
		return messageParser.convertTyped( msg.data[ 2 ] );
	}

	if( msg.topic === C.TOPIC.RECORD && msg.action === C.ACTIONS.UPDATE ) {
		return messageParser.convertTyped( msg.data[ 2 ] );
	}

	if( msg.topic === C.TOPIC.RECORD && msg.action === C.ACTIONS.PATCH ) {
		if( this._recordData[ this._params.name ] ) {
			//TODO copy data and apply patch
			return {};
		} else {
			this._loadRecord( this._params.name );
		}
	}
};

RuleApplication.prototype._getOldData = function() {
	if( this._params.rule.hasOldData === false ) {
		return null;
	} else if( this._recordData[ this._params.name ] ) {
		return this._recordData[ this._params.name ];
	} else {
		this._loadRecord( this._params.name );
	}
};

RuleApplication.prototype._getArguments = function() {
	return [
		this._crossReferenceFn,
		this._user,
		this._getCurrentData(),
		this._getOldData(),
		Date.now(),
		this._params.action
	].concat( this._pathVars );
};

RuleApplication.prototype._getUser = function() {
	return {
		isAuthenticated: this._params.username !== OPEN,
		id: this._params.username,
		data: this._params.authData
	};
};

RuleApplication.prototype._getPathVars = function() {
	return this._params.name.match( this._params.regexp ).slice( 1 );
};

RuleApplication.prototype._loadRecord = function( recordName ) {
	if( this._recordData[ recordName ] === LOADING ) {
		return;
	}

	if( this._recordData[ recordName ] ) {
		this._onLoadComplete( recordName, this._recordData[ recordName ] );
		return;
	}

	this._isLoading = true;
	//TODO actually load the record
};

RuleApplication.prototype._crossReference = function( recordName ) {
	if( typeof recordName === UNDEFINED || recordName.indexOf( UNDEFINED ) !== -1 ) {
		return;
	}
	else if( this._recordData[ recordName ] ) {
		return this._recordData[ recordName ];
	}
	else {
		this._loadRecord( recordName );
	}
};


module.exports = RuleApplication;