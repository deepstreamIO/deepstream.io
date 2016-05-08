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

ConfigPermissionHandler.prototype.canPerformAction = function( username, message, callback, authData ) {
	var ruleSpecification = rulesMap.getRulesForMessage( message );

	//Is this a message that needs permissioning at all?
	if( ruleSpecification === null ) {
		callback( null, true );
		return;
	}
	var name = message.data[ 0 ];
	var applicableRules = this._getCompiledRulesForName( name, ruleSpecification );

	if( applicableRules === null ) {
		//TODO - deny everything by default if no rule is specified?
		callback( null, true );
		return;
	}

	var result;

	//'_', 'user', 'data', 'oldData', 'now', 'action';
	var _ = function( recordName ) {
		console.log( 'cross reference called', recordName );
	};

	var user = {
		isAuthenticated: username !== 'open',
		id: username,
		data: authData
	};

	var data = {};
	var oldData = {};
	var now = Date.now();
	var action = ruleSpecification.action;
	var pathVars = name.match( applicableRules.regexp ).slice( 1 );
	var args = [ _, user, data, oldData, now, action ].concat( pathVars );

	for( var i = 0; i < applicableRules.rules.length; i++ ) {
		result = applicableRules.rules[ i ].fn.apply( {}, args );
	}

	callback( null, result );
};


ConfigPermissionHandler.prototype._getCompiledRulesForName = function( name, ruleSpecification ) {

	if( this._ruleCache[ name ] ) {
		return this._ruleCache[ name ];
	}

	/*
	 * TODO: Take specificity into account
	 * TODO: Return one rule per ruletype
	 * TODO: Only return rule for read / write / validate etc.
	 * TODO: Cache rules and keep usage count.
	 */
	var section = this._config[ ruleSpecification.section ];
	var i;
	var pathLength = 0;
	var result;
	for( i = 0; i < section.length; i++ ) {
		if( section[ i ].regexp.test( name ) && section[ i ].path.length >= pathLength ) {
			pathLength = section[ i ].path.length;
			result = {
				regexp: section[ i ].regexp,
				rules: [ section[ i ].rules[ ruleSpecification.ruleTypes ] ]
			};
		}
	}

	return result || null;
};

module.exports = ConfigPermissionHandler;