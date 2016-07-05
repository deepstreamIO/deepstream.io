'use strict';
const EventEmitter = require( 'events' ).EventEmitter;

/**
 * Used for users that don't provide a username
 *
 * @type {String}
 */
const OPEN = 'open';

/**
 * The open authentication handler allows every client to connect.
 * If the client specifies a username as part of its authentication
 * data, it will be used to identify the user internally
 *
 * @class OpenAuthenticationHandler
 */
module.exports = class OpenAuthenticationHandler extends EventEmitter{
	/**
	 * @param {String} type exposes the type for logging purposes. This one is called
	 *                      none to avoid confusion with openAuth
	 */
	constructor() {
		super();
		this.type = 'none';
		this.isReady = true;
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
		callback( true, { username: authData.username || OPEN });
	}
}