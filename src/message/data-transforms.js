var C = require( '../constants/constants' );

/**
 * This class converts the data-transformation settings the user specified as
 * part of deepstream's options into an object that makes them easily
 * accesible and executable.
 *
 * @param {Array} settings An array of maps in the format
 *
 * [{
 * 	   topic: <String>,
 * 	   action: <String>,
 * 	   transform: <Function>
 * },
 * {...}
 * ]
 *
 * @constructor
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

	if( !(settings instanceof Array ) ) {
		throw new Error( 'option dataTransforms must be an array or null' );
	}

	settings.forEach( this._setTransform.bind( this ) );
};

/**
 * Returns true if a transformation function has been registered for a
 * topic/action combination
 *
 * @param   {String}  topic  One of C.TOPIC
 * @param   {String}  action One of C.ACTION
 *
 * @public
 * @returns {Boolean}
 */
DataTransforms.prototype.has = function( topic, action ) {
	return !!( this._transforms[ topic ] && this._transforms[ topic ][ action ] );
};

/**
 * Invokes the data-transform function. This will error when the transform
 * function is not specified, so test before invocation with DataTransforms.has
 *
 * @param   {String}  topic  One of C.TOPIC
 * @param   {String}  action One of C.ACTION
 * @param   {Object}  data   The data that will be manipulated
 * @param   {Object}  metaData Additional data
 *
 * @public
 * @returns {Object} the manipulated data
 */
DataTransforms.prototype.apply = function( topic, action, data, metaData ) {
	return this._transforms[ topic ][ action ]( data, metaData );
};

/**
 * Called for every entry in the settings array. Validates the provided setting
 * and stores it in the settings cache if valid
 *
 * @param {Object} setting An entry from the settings array that was provided to the constructor
 *
 * @private
 * @returns {void}
 */
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