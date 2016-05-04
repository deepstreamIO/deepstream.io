var configValidator = require( './config-validator' );
var configCompiler = require( './config-compiler' );


var ConfigPermissionHandler = function( config ) {
	var validationResult = configValidator.validate( config );
	if( validationResult !== true ) {
		throw new Error( validationResult );
	}
	this._config = configCompiler.compile( config );
};

//TODO remove
ConfigPermissionHandler.prototype.isValidUser = function( connectionData, authData, callback ) {
	callback( null, 'authenticated-user', { 'some': 'metaData' } );
};

ConfigPermissionHandler.prototype.canPerformAction = function( username, message, callback, data ) {

};