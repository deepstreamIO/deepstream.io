var configValidator = require( './config-validator' );

var ConfigPermissionHandler = function( config ) {
	var validationResult = configValidator.validate( config );
	if( validationResult !== true ) {
		throw new Error( validationResult );
	}
	this._config = config;
};