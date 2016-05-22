'use strict';

const HttpAuthenticationRequest = require( './http-authentication-request' );
const EventEmitter = require( 'events' ).EventEmitter;
const utils = require( '../utils/utils' );
const url = require( 'url' );
const UNDEFINED = 'undefined';
const STRING = 'string';

/**
 *
 * @public
 * @extends {EventEmitter}
 */
module.exports = class HttpAuthenticationHandler extends EventEmitter{

	/**
	 * Creates the class
	 *
	 * @param   {Object} settings
	 * @param   {String} settings.endpointUrl http(s) endpoint that will receive post requests
	 *
	 * @constructor
	 * @returns {void}
	 */
	constructor( settings ) {
		super();

		this.isReady = true;
		this._settings = settings;
		this._validateSettings();
		this._params = this._createUrlParams();
	}

	/**
	 * Main interface. Authenticates incoming connections
	 *
	 * @param   {Object}   connectionData
	 * @param   {Object}   authData
	 * @param   {Function} callback
	 *
	 * @public
	 * @implements {PermissionHandler.isValidUser}
	 * @returns {void}
	 */
	isValidUser( connectionData, authData, callback ) {
		new HttpAuthenticationRequest( utils.deepCopy( this._params ), connectionData, authData, callback );
	}

	_createUrlParams() {
		var params = url.parse( this._settings.endpointUrl );

		if( params.host === null ) {
			throw new Error( 'invalid endpoint url ' + this._settings.endpointUrl );
		}

		params.method = 'POST';
		params.headers = {
			'Content-Type': 'application/json',
		}

		return params;
	}

	_validateSettings() {
		if( typeof this._settings.endpointUrl !== STRING ) {
			throw new Error( 'Missing setting endpointUrl for HttpAuthenticationHandler' );
		}
	}
}

