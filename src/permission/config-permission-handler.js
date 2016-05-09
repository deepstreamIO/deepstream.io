var configValidator = require( './config-validator' );
var configCompiler = require( './config-compiler' );
var rulesMap = require( './rules-map' );
var RuleApplication = require( './rule-application' );

var ConfigPermissionHandler = function( options, config ) {
	this._ruleCache = {};
	this._options = options;
	this._config = null;

	if( config ) {
		this.useConfig( config );
	}
};


//TODO remove
ConfigPermissionHandler.prototype.isValidUser = function( connectionData, authData, callback ) {
	callback( null, 'authenticated-user', { 'some': 'metaData' } );
};

ConfigPermissionHandler.prototype.loadConfig = function( path ) {

};

ConfigPermissionHandler.prototype.useConfig = function( config ) {
	var validationResult = configValidator.validate( config );
	if( validationResult !== true ) {
		throw new Error( validationResult );
	}
	this._config = configCompiler.compile( config );
};

ConfigPermissionHandler.prototype.canPerformAction = function( username, message, callback, authData ) {
	var ruleSpecification = rulesMap.getRulesForMessage( message );
	var name = message.data[ 0 ];
	var ruleData;

	//Is this a message that needs permissioning at all?
	if( ruleSpecification === null ) {
		callback( null, true );
		return;
	}

	ruleData = this._getCompiledRulesForName( name, ruleSpecification );

	if( ruleData === null ) {
		//TODO - discuss: deny or allow everything by default if no rule is specified?
		callback( null, true );
		return;
	}

	new RuleApplication({
		username: username,
		authData: authData,
		ruleSpecification:ruleSpecification,
		message: message,
		action: ruleSpecification.action,
		regexp: ruleData.regexp,
		rule: ruleData.rule,
		name:name,
		callback: callback,
		options: this._options
	});
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
				rule: section[ i ].rules[ ruleSpecification.type ]
			};
		}
	}

	return result || null;
};

module.exports = ConfigPermissionHandler;