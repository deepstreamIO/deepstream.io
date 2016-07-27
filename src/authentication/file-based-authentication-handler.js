'use strict';

const crypto = require( 'crypto' );
const jsYamlLoader = require( '../config/js-yaml-loader' );
const utils = require( '../utils/utils' );
const EventEmitter = require( 'events' ).EventEmitter;
const STRING = 'string';
const STRING_CHARSET = 'base64';

/**
 * This authentication handler reads a list of users and their associated password (either
 * hashed or in cleartext ) from a json file. This can be useful to authenticate smaller amounts
 * of clients with static credentials, e.g. backend provider that write to publicly readable records
 *
 * @public
 * @extends {EventEmitter}
 */
module.exports = class FileBasedAuthenticationHandler extends EventEmitter {

	/**
	 * Creates the class, reads and validates the users.json file
	 *
	 * @param   {Object} settings
	 * @param   {String} settings.path path to the user file
	 * @param   {String} settings.hash the name of a HMAC digest algorithm, a.g. 'sha512'
	 * @param   {Int} settings.iterations the amount of times the algorithm should be applied
	 * @param   {Int} settings.keyLength the length of the resulting key
	 *
	 * @constructor
	 * @returns {void}
	 */
	constructor( settings ) {
		super();
		this.isReady = false;
		this.type = 'file using ' + settings.path;
		this._validateSettings( settings );
		this._settings = settings;
		this._base64KeyLength = 4 * Math.ceil( this._settings.keyLength / 3 );
		jsYamlLoader.readAndParseFile( settings.path, this._onFileLoad.bind( this ) );
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
		if( typeof authData.username !== STRING ) {
			callback( false, { clientData: 'missing authentication parameter username' } );
			return;
		}

		if( typeof authData.password !== STRING ) {
			callback( false, { clientData: 'missing authentication parameter password' } );
			return;
		}

		var userData = this._data[ authData.username ];

		if( !userData ) {
			callback( false );
			return;
		}

		if( this._settings.hash ) {
			this._isValid( authData.password, userData.password, authData.username, userData.serverData, userData.clientData, callback );
		} else if( authData.password === userData.password ) {
			callback( true, {
				username: authData.username,
				serverData: typeof userData.serverData === 'undefined' ? null : userData.serverData,
				clientData: typeof userData.serverData === 'undefined' ? null : userData.serverData
			} );
		} else {
			callback( false );
		}
	}

	/**
	 * Utility method for creating hashes including salts based on
	 * the provided parameters
	 *
	 * @todo  this needs to be exposed to users, maybe via CLI?
	 *
	 * @param   {String}   password the password that should be hashed
	 * @param   {Function} callback will be invoked with error, hash once hashing is completed
	 *
	 * @public
	 * @returns {void}
	 */
	createHash( password, callback ) {
		var salt = crypto.randomBytes( 16 ).toString( STRING_CHARSET );

		crypto.pbkdf2(
			password,
			salt,
			this._settings.iterations,
			this._settings.keyLength,
			this._settings.hash,
			function( err, hash ) {
				callback( err || null, hash.toString( STRING_CHARSET ) + salt );
			}.bind( this )
		);
	}

	/**
	 * Callback for loaded JSON files. Makes sure that
	 * no errors occured and every user has an associated password
	 *
	 * @param   {Error} 	error an error that occured during loading or parsing the file
	 * @param   {Object} 	data  parsed contents of the file
	 *
	 * @private
	 * @returns {void}
	 */
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

	/**
	 * Called initially to validate the user provided settings
	 *
	 * @param   {Object} settings
	 *
	 * @private
	 * @returns {void}
	 */
	_validateSettings( settings ) {
		if( !settings.hash ) {
			utils.validateMap( settings, true, {
				path: 'string'
			} );
			return;
		}

		utils.validateMap( settings, true, {
			path: 'string',
			hash: 'string',
			iterations: 'number',
			keyLength: 'number'
		} );

		if( crypto.getHashes().indexOf( settings.hash ) === -1 ) {
			throw new Error( 'Unknown Hash ' + settings.hash );
		}
	}

	/**
	 * Extracts hash and salt from a string and runs a hasing function
	 * against it
	 *
	 * @param   {String}   password             the cleartext password the user provided
	 * @param   {String}   passwordHashWithSalt the hash+salt combination from the users.json file
	 * @param   {String}   username             as provided by user
	 * @param   {Object}   serverData           arbitrary authentication data that will be passed on to the permission handler
	 * @param   {Object}   clientData           arbitrary authentication data that will be passed on to the client
	 * @param   {Function} callback             callback that will be invoked once hash is created
	 *
	 * @private
	 * @returns {void}
	 */
	_isValid( password, passwordHashWithSalt, username, serverData, clientData, callback ) {
		var expectedHash = passwordHashWithSalt.substr( 0, this._base64KeyLength );
		var salt = passwordHashWithSalt.substr( this._base64KeyLength );

		crypto.pbkdf2(
			password,
			salt,
			this._settings.iterations,
			this._settings.keyLength,
			this._settings.hash,
			this._compareHashResult.bind( this, expectedHash, username, serverData, clientData, callback )
		);
	}

	/**
	 * Callback once hashing is completed
	 *
	 * @param   {String}   expectedHash     has as retrieved from users.json
	 * @param   {Object}   serverData       arbitrary authentication data that will be passed on to the permission handler
	 * @param   {Object}   clientData       arbitrary authentication data that will be passed on to the client
	 * @param   {Function} callback         callback from isValidUser
	 * @param   {Error}    error            error that occured during hashing
	 * @param   {Buffer}   actualHashBuffer the buffer containing the bytes for the new hash
	 *
	 * @private
	 * @returns {void}
	 */
	_compareHashResult( expectedHash, username, serverData, clientData, callback, error, actualHashBuffer ) {
		if( expectedHash === actualHashBuffer.toString( STRING_CHARSET ) ) {
			//todo log error
			callback( true, {
				username: username,
				serverData: serverData || null,
				clientData: clientData || null
			} );
		} else {
			callback( false );
		}
	}
};
