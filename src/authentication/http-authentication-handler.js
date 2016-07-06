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
	 * @param 	{Logger} logger
	 *
	 * @constructor
	 * @returns {void}
	 */
	constructor( settings, logger ) {
		super();
		this.isReady = true;
		this.type = 'http webhook to ' + settings.endpointUrl;
		this._settings = settings;
		this._logger = logger;
		this._validateSettings();
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
			{ connectionData: connectionData, authData: authData },
			this._settings,
			this._logger,
			callback
		);
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