'use strict';

const crypto = require( 'crypto' );
const fs = require( 'fs' );
const EventEmitter = require( 'events' ).EventEmitter;
const utils = require( '../utils/utils' );
const UNDEFINED = 'undefined';

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
		this._validateSettings( settings );
		this._settings = settings;
		this.loadFile( settings.path );
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
		callback( null, authData.username || OPEN );
	}

	loadFile( path ) {
		fs.readFile( path, 'utf8', this._onFileLoad.bind( this, path ) );
	}

	_onFileLoad( error, data ) {
		if( loadError ) {
			this.emit( 'error', 'error while loading config: ' + loadError.toString() );
			return;
		}

		try{
			this._data = JSON.parse( data );
		} catch( parseError ) {
			this.emit( 'error', 'error while parsing config: ' + parseError.toString() );
		}
	}

	_validateSettings( settings ) {
		var validationResult = utils.validateMap( settings, {
			path: 'string',
			hashAlgo: 'string',
			iterations: 'number',
			keyLength: 'number',
			watch: 'boolean'
		});

		if( validationResult !== true ) {
			throw validationResult;
		}

		if( !crypto.getHashes().contains( settings.hash ) ) {
			throw new Error( 'Unknown Hash ' + settings.hash );
		}
	}

	_isValid( password, passwordHashWithSalt, callback ) {
		crypto.pbkdf2(
			password,
			passwordHashWithSalt.substr( this._settings.keyLength ),
			this._settings.iterations,
			this._settings.keyLength,
			this._settings.hashAlgo,
			this._compareHashResult.bind( this, passwordHashWithSalt )
		);
	}

	_compareHashResult( passwordHashWithSalt, error, hash ) {
		callback( error, hash === passwordHashWithSalt );
	}
}