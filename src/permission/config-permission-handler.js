var configValidator = require( './config-validator' );
var configCompiler = require( './config-compiler' );
var rulesMap = require( './rules-map' );

var ConfigPermissionHandler = function( config ) {
	this._ruleCache = {};
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
	var ruleSpecification = rulesMap.getRulesForMessage( message );

	//Is this a message that needs permissioning at all?
	if( ruleSpecification === null ) {
		callback( null, true );
		return;
	}

	var rule = this._getRuleForName( message.data[ 0 ], ruleSpecification.rules );

	//this._executeRule
};

ConfigPermissionHandler.prototype._getRuleForName = function( name, ruleTypes ) {
	if( this._ruleCache[ name ] ) {
		return this._ruleCache[ name ];
	}

	/*
	 * TODO: Take specificity into account
	 * TODO: Return one rule per ruletype
	 * TODO: Cache rules and keep usage count.
	 */
	for( i = 0; i < this._config[ rules.section ].length; i++ ) {
		if( this._config[ rules.section ][ i ].regexp.test( name ) ) {
			return [ this._config[ rules.section ][ i ] ];
		}
	}

	return null;
};