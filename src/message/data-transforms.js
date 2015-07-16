var C = require( '../constants/constants' );

/**
 * [DataTransforms description]
 *
 * @param {[type]} settings An array of maps in the format
 *
 * [{
 * 	topic: <String>,
 * 	action: <String>,
 * 	transform: <Function>
 * },
 * {...}
 * ]
 */
var DataTransforms = function( settings ) {
	this._transforms = {};

	this._transforms[ C.TOPIC.RPC ] = {};
	this._transforms[ C.TOPIC.RPC ][ C.ACTIONS.REQUEST ] = null;
	this._transforms[ C.TOPIC.RPC ][ C.ACTIONS.RESPONSE ] = null;

	this._transforms[ C.TOPIC.EVENT ] = {};
	this._transforms[ C.TOPIC.EVENT ][ C.ACTIONS.EVENT ] = null;

	this._transforms[ C.TOPIC.RECORD ] = {};
	this._transforms[ C.TOPIC.RECORD ][ C.ACTIONS.READ ] = null;
	this._transforms[ C.TOPIC.RECORD ][ C.ACTIONS.UPDATE ] = null;
	this._transforms[ C.TOPIC.RECORD ][ C.ACTIONS.PATCH ] = null;

	settings.forEach( this._setTransform.bind( this ) );
};

DataTransforms.prototype.has = function( topic, action ) {
	return this._transforms[ topic ] && this._transforms[ topic ][ action ];
};

DataTransforms.prototype.apply = function( topic, action, data, username ) {
	return this._transforms[ topic ][ action ]( data, username );
};

DataTransforms.prototype._setTransform = function( setting ) {
	if( typeof setting !== 'object' ) {
		throw new Error( 'transformation is not a map' );
	}

	if( this._transforms[ setting.topic ] === undefined ) {
		throw new Error( 'Transforms for topic ' + setting.topic + ' are not supported' );
	}

	if( this._transforms[ setting.topic ][ setting.action ] === undefined ) {
		throw new Error( 'Transforms for action ' + setting.action + ' are not supported for topic ' + setting.topic );
	}

	if( typeof setting.transform !== 'function' ) {
		throw new Error( 'setting.transform must be a function' );
	}

	if( this._transforms[ setting.topic ][ setting.action ] !== null ) {
		throw new Error( 'transformation already registered for ' + setting.topic + ' ' + setting.action );
	}

	this._transforms[ setting.topic ][ setting.action ] = setting.transform;
};

module.exports = DataTransforms;