'use strict';

const HttpAuthenticationRequest = require( './http-authentication-request' );
const EventEmitter = require( 'events' ).EventEmitter;
const utils = require( '../utils/utils' );
const url = require( 'url' );

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
	 * @param   {Array}  settings.permittedStatusCodes an array of http status codes that qualify as permitted
	 * @param   {Number} settings.requestTimeout time in milliseconds before the request times out if no reply is received
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
		new HttpAuthenticationRequest(
			this._params,
			connectionData,
			authData,
			this._settings,
			callback
		);
	}

	/**
	 * Parses the provided endpoint URL and extends the resulting
	 * parameter set with values for the outgoing request
	 *
	 * @private
	 * @returns {void}
	 */
	_createUrlParams() {
		var params = url.parse( this._settings.endpointUrl );
		params.method = 'POST';
		params.headers = { 'Content-Type': 'application/json' };
		return params;
	}

	/**
	 * Validate the user provided settings
	 *
	 * @private
	 * @returns {void}
	 */
	_validateSettings() {
		utils.validateMap( this._settings, true, {
			endpointUrl: 'url',
			permittedStatusCodes: 'array',
			requestTimeout: 'number'
		});
	}
}