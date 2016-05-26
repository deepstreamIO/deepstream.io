'use strict';

const fs = require( 'fs' );
const STRING = 'string';
const UTF8 = 'utf8';

/**
 * Loads and parses JSON files and handles associated errors
 */
module.exports = class JsonLoader{

	/**
	 * Main interface. Attempts to load the file at path,
	 * parse it and return its data to callback
	 *
	 * @param   {String}   path     relative path to the json file
	 * @param   {Function} callback will be called with error and data
	 *
	 * @public
	 * @returns {void}
	 */
	load( path, callback ) {
		if( typeof path !== STRING ) {
			callback( 'invalid path ' + path );
		}
		else {
			fs.readFile( path, UTF8, this._onFileLoad.bind( this, callback ) );
		}
	}

	/**
	 * Callback for fs.readFile
	 *
	 * @param   {Function} callback will be called with error and data
	 * @param   {Error}    error    load error or null
	 * @param   {String}   rawData  raw content of the file
	 *
	 * @private
	 * @returns {void}
	 */
	_onFileLoad( callback, error, rawData ) {
		if( error ) {
			callback( 'error while loading config: ' + error.toString() );
			return;
		}

		var data;

		try{
			data = JSON.parse( rawData );
		} catch( parseError ) {
			callback( 'error while parsing config: ' + parseError.toString() );
			return;
		}

		callback( null, data );
	}
}