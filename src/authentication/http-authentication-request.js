'use strict';

const http = require( 'http' );

module.exports = class HttpAuthenticationRequest{
	constructor( params, connectionData, authData, callback ) {
		this._postDataString = this._createPostData( connectionData, authData );
		this._params = this._createParams( params );
		this._callback = callback;
		this._response = null;
		this._responseText = '';
		this._request = http.request( this._params, this._onResponse.bind( this ) );
		this._request.on( 'error', this._onError.bind( this ) );
		this._request.write( this._postDataString );
		this._request.end();
	}
	_createParams( params ) {
		params.headers[ 'Content-Length' ] = this._postDataString.length;
		return params;
	}
	_createPostData( connectionData, authData ) {
		return JSON.stringify({
			connectionData: connectionData,
			authData: authData
		});
	}
	_onResponse( response ) {
		this._response = response;
		this._response.setEncoding( 'utf8' );
		this._response.on( 'data', this._addChunk.bind( this ) );
		this._response.on( 'end', this._onComplete.bind( this ) );
	}
	_addChunk( chunk ) {
		this._responseText += chunk;
	}
	_onComplete() {
		if( this._response.statusCode !== 200 ) {
			this._onServerReject( this._response.statusCode );
			return;
		}

		var data;
		try{
			data = JSON.parse( this._responseText );
		} catch( e ) {
			callback( 'error while parsing server response ' + e.toString(), false );
			return;
		}

		this._callback( null, true, data || null );
		this._destroy();
	}
	_onServerReject( statusCode ) {
		if( statusCode >= 500 && statusCode < 600 ) {
			this._callback( this._responseText, false );
		} else {
			this._callback( null, false );
		}
	}
	_onError( error ) {
		this._callback( 'error while making authentication request' + error.toString(), false, null );
		this._destroy();
	}
	_destroy() {
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