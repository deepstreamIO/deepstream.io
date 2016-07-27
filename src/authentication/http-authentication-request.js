'use strict';

const needle = require( 'needle' );
const C = require( '../constants/constants' );

/**
 * This class represents a single request from deepstream to a http
 * endpoint for authentication data
 */
module.exports = class HttpAuthenticationRequest{

	/**
	 * Creates and issues the request and starts the timeout
	 *
	 * @param   {Object}   data           Map with authData and connectionData
	 * @param   {Object}   settings       contains requestTimeout and permittedStatusCodes
	 * @param   {Function} callback       Called with error, isAuthenticated, userData
	 * @param 	{Logger}   logger
	 *
	 * @constructor
	 * @returns {void}
	 */
	constructor( data, settings, logger, callback ) {
		this._settings = settings;
		this._callback = callback;
		this._logger = logger;

		var options = {
			read_timeout: settings.requestTimeout,
			open_timeout: settings.requestTimeout,
			timeout: settings.requestTimeout,
			follow_max : 2,
			json: true
		};

		needle.post( settings.endpointUrl, data, options, this._onComplete.bind( this ) );
	}

	/**
	 * Invoked for completed responses, whether succesful
	 * or erroures
	 *
	 * @param {Error} error HTTP Error
	 * @param {http.Response} response
	 *
	 * @private
	 * @returns {void}
	 */
	_onComplete( error, response ) {
		if( error ) {
			this._settings.logger.log( C.LOG_LEVEL.WARN, C.EVENT.AUTH_ERROR, 'http auth error: ' + error );
			this._callback( false, null );
			this._destroy();
			return;
		}

		if( response.statusCode >= 500 && response.statusCode < 600 ) {
			this._settings.logger.log( C.LOG_LEVEL.WARN, C.EVENT.AUTH_ERROR, 'http auth server error: ' + response.body );
		}

		if( this._settings.permittedStatusCodes.indexOf( response.statusCode ) === -1 ) {
			this._callback( false, response.body || null )
		} else if( response.body && typeof response.body === 'string' ) {
			this._callback( true, { username: response.body });
		} else {
			this._callback( true, response.body || null );
		}

		this._destroy();
	}

	/**
	 * Destroys the class
	 *
	 * @private
	 * @returns {void}
	 */
	_destroy() {
		this._callback = null;
		this._settings = null;
		this._logger = null;
	}
}