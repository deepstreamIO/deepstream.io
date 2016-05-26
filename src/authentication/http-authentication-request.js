'use strict';

const http = require( 'http' );
const utils = require( '../utils/utils' );
const C = require( '../constants/constants' );

/**
 * This class represents a single request from deepstream to a http
 * endpoint for authentication data
 */
module.exports = class HttpAuthenticationRequest{

	/**
	 * Creates and issues the request and starts the timeout
	 *
	 * @param   {Object}   params         request parameter as created by HttpAuthenticationHandler.getParams
	 * @param   {Object}   connectionData the handshake / tcp connection data for the incoming connection
	 * @param   {Object}   authData       the authenticationd data the user provided
	 * @param   {Object}   settings       contains requestTimeout and permittedStatusCodes
	 * @param   {Function} callback       Called with error, isAuthenticated, authData
	 *
	 * @constructor
	 * @returns {void}
	 */
	constructor( params, connectionData, authData, settings, callback ) {
		this._postDataString = this._createPostData( connectionData, authData );
		this._params = this._createParams( params );
		this._timeout = setTimeout( this._onError.bind( this, 'request timed out' ), settings.requestTimeout );
		this._settings = settings;
		this._callback = callback;
		this._response = null;
		this._responseText = '';
		this._request = http.request( this._params, this._onResponse.bind( this ) );
		this._request.on( 'error', this._onError.bind( this ) );
		this._request.write( this._postDataString );
		this._request.end();
	}

	/**
	 * Copies the provided parameters and adds a content length
	 * header specific to this request's data
	 *
	 * @param   {Object}   params  request parameter as created by HttpAuthenticationHandler.getParams
	 *
	 * @private
	 * @returns {Object} params
	 */
	_createParams( params ) {
		params = utils.deepCopy( params );
		params.headers[ 'Content-Length' ] = this._postDataString.length;
		return params;
	}

	/**
	 * Creates the post data string that will be send with the request
	 *
	 * @param   {Object}   connectionData the handshake / tcp connection data for the incoming connection
	 * @param   {Object}   authData       the authenticationd data the user provided
	 *
	 * @private
	 * @returns {String} postData
	 */
	_createPostData( connectionData, authData ) {
		return JSON.stringify({
			connectionData: connectionData,
			authData: authData
		});
	}

	/**
	 * Invoked as soon as the start of the server's response
	 * is received. The response will be complete in onComplete
	 *
	 * @param   {http.IncomingMessage} response
	 *
	 * @private
	 * @returns {void}
	 */
	_onResponse( response ) {
		this._response = response;
		this._response.setEncoding( 'utf8' );
		this._response.on( 'data', this._addChunk.bind( this ) );
		this._response.on( 'end', this._onComplete.bind( this ) );
	}

	/**
	 * Concatenate incoming, chunk encoded post data
	 *
	 * @param {String} chunk Chunks are already converted to utf-8 strings
	 *
	 * @private
	 * @returns {void}
	 */
	_addChunk( chunk ) {
		this._responseText += chunk;
	}

	/**
	 * Invoked for completed responses, whether succesful
	 * or erroures
	 *
	 * @private
	 * @returns {void}
	 */
	_onComplete() {
		if( this._settings.permittedStatusCodes.indexOf( this._response.statusCode ) === -1 ) {
			this._onServerReject( this._response.statusCode );
		} else {
			this._callback( true, this._getResponseData() );
		}

		this._destroy();
	}

	/**
	 * If the server provided data in the message body, this method
	 * tries to parse it to a json object or return it as a string
	 * if unparsable
	 *
	 * @private
	 * @returns {String|Object} data
	 */
	_getResponseData() {
		if( !this._responseText ) {
			return null;
		} else {
			try{
				return JSON.parse( this._responseText );
			} catch( e ) {
				return { username: this._responseText }
			}
		}
	}

	/**
	 * Handles rejection messages from the server
	 *
	 * @param   {Number} statusCode the http status code the server provided
	 *
	 * @private
	 * @returns {void}
	 */
	_onServerReject( statusCode ) {
		if( statusCode >= 500 && statusCode < 600 ) {
			this._logError( 'received error for http auth request: ' + this._responseText );
		}
		this._callback( false, this._getResponseData() );
	}

	/**
	 * Handles errors that occured while making the request
	 *
	 * @param   {Error|String} error
	 *
	 * @private
	 * @returns {void}
	 */
	_onError( error ) {
		this._logError( 'error while making authentication request: ' + error.toString() );
		this._callback( false );
		this._destroy();
	}

	/**
	 * Logs http related errors as warnings
	 *
	 * @param   {String} errorMsg
	 *
	 * @private
	 * @returns {void}
	 */
	_logError( errorMsg ) {
		this._settings.logger.log( C.LOG_LEVEL.WARN, C.EVENT.AUTH_ERROR, errorMsg );
	}

	/**
	 * Destroys the request, either as result of an error or its completion
	 *
	 * @private
	 * @returns {void}
	 */
	_destroy() {
		clearTimeout( this._timeout );
		this._request.removeAllListeners();
		if( this._response ) this._response.removeAllListeners();
		this._postDataString = null;
		this._callback = null;
		this._params = null;
		this._request = null;
		this._response = null;
		this._responseText = null;
	}
}