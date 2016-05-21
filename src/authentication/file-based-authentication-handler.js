'use strict';

const crypto = require( 'crypto' );
const JsonLoader = require( '../utils/json-loader' );
const utils = require( '../utils/utils' );
const EventEmitter = require( 'events' ).EventEmitter;
const UNDEFINED = 'undefined';
const STRING = 'string';
const STRING_CHARSET = 'base64';

module.exports = class FileBasedAuthenticationHandler extends EventEmitter{

	/**
	 * [constructor description]
	 *
	 * @param   {Object} settings
	 * @param   {String} settings.path path to the user file
	 * @param   {String} settings.hashAlgo the name of a HMAC digest algorithm, a.g. 'sha512'
	 * @param   {Int} settings.iterations the amount of times the algorithm should be applied
	 * @param   {Int} settings.keyLength the length of the resulting key
	 * @param   {Boolean} watch	if true, the FileBasedAuthenticationHandler will reload the permissions whenver the file changes
	 * @param
	 *
	 * @returns {[type]}
	 */
	constructor( settings ) {
		super();
		this.isReady = false;
		this._jsonLoader = new JsonLoader();
		this._validateSettings( settings );
		this._settings = settings;
		this._base64KeyLength = 4 * Math.ceil( this._settings.keyLength / 3 );
		this._jsonLoader.load( settings.path, this._onFileLoad.bind( this ) );
	}
	/**
	 * Grants access to any user. Registeres them with username or open
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
		if( typeof authData.username !== STRING ) {
			callback( 'missing authentication parameter username' );
			return;
		}

		if( typeof authData.password !== STRING ) {
			callback( 'missing authentication parameter password' );
			return;
		}

		var userData = this._data[ authData.username ];

		if( !userData ) {
			callback( null, false );
			return;
		}

		if( this._settings.hash ) {
			this._isValid( authData.password, userData.password, callback );
		} else {
			callback( null, authData.password === userData.password );
		}
	}

	createHash( password, callback ) {
		var salt = crypto.randomBytes( 16 ).toString( STRING_CHARSET );

		crypto.pbkdf2(
			password,
			salt,
			this._settings.iterations,
			this._settings.keyLength,
			this._settings.hashAlgo,
			function( err, hash ) {
				callback( err, hash.toString( STRING_CHARSET ) + salt );
			}.bind( this )
		);
	}

	_onFileLoad( error, data ) {
		if( error ) {
			this.emit( 'error', error.toString() );
		} else {
			this._data = data;
		}

		for( var username in this._data ) {
			if( typeof this._data[ username ].password !== STRING ) {
				this.emit( 'error', 'missing password for ' + username );
			}
		}

		this.isReady = true;
		this.emit( 'ready' );
	}

	_validateSettings( settings ) {
		if( !settings.hash ) {
			utils.validateMap( settings, true, {
				path: 'string',
				watch: 'boolean'
			});
			return;
		}

		utils.validateMap( settings, true, {
			path: 'string',
			hash: 'string',
			iterations: 'number',
			keyLength: 'number',
			watch: 'boolean'
		});

		if( crypto.getHashes().indexOf( settings.hash ) === -1 ) {
			throw new Error( 'Unknown Hash ' + settings.hash );
		}
	}

	_isValid( password, passwordHashWithSalt, callback ) {
		var expectedHash = passwordHashWithSalt.substr( 0, this._base64KeyLength );
		var salt = passwordHashWithSalt.substr( this._base64KeyLength );

		crypto.pbkdf2(
			password,
			salt,
			this._settings.iterations,
			this._settings.keyLength,
			this._settings.hashAlgo,
			this._compareHashResult.bind( this, expectedHash, callback )
		);
	}

	_compareHashResult( expectedHash, callback, error, actualHashBuffer ) {
		callback( error || null, expectedHash === actualHashBuffer.toString( STRING_CHARSET ) );
	}
}