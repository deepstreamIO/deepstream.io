var configValidator = require( './config-validator' );
var configCompiler = require( './config-compiler' );


var ConfigPermissionHandler = function( config ) {
	var validationResult = configValidator.validate( config );
	if( validationResult !== true ) {
		throw new Error( validationResult );
	}
	this._config = configCompiler.compile( config );
};

ConfigPermissionHandler.prototype.canPerformAction = function( username, message, callback ) {

};