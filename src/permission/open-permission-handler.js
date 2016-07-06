'use strict';

const EventEmitter = require( 'events' ).EventEmitter;

/**
 * The open permission handler allows any action to occur without applying
 * any permissions.
 *
 * @class OpenPermissionHandler
 */
module.exports = class OpenPermissionHandler extends EventEmitter{
	/**
	 * @param {String} type exposes the type for logging purposes
	 */
	constructor() {
		super();
		this.type = 'none';
		this.isReady = true;
	}

	/**
	 * Allows any action by an user
	 *
	 * @param   {String}   username the name of the connected user, as specified in isValidUser
	 * @param   {Object}   message  a parsed deepstream message
	 * @param   {Function} callback the callback to provide the result
	 * @param   {[Object]}   authData additional optional authData as passed to isValidUser
	 *
	 * @public
	 * @implements {PermissionHandler.isValidUser}
	 * @returns {void}
	 */
	canPerformAction( username, message, callback, authData ) {
		callback( null, true );
	}
}