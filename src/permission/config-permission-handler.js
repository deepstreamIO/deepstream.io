var configValidator = require( './config-validator' );
var configCompiler = require( './config-compiler' );
var rulesMap = require( './rules-map' );

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
	var rules = rulesMap.getRulesForMessage( message );

	//Is this a message that needs permissioning at all?
	if( rules === null ) {
		callback( null, true );
		return;
	}

	// Get record / event / rpc name from message
	//Do we have a rule for that message?
	for( var i = 0; i < this._config[ rules.section ].length; i++ ) {

	}

};