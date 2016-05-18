var pathParser = require( './path-parser' );
var ruleParser = require( './rule-parser' );
var validationSteps = {};
var SCHEMA = require( './config-schema' );

/**
 * Validates a configuration object. This method runs through multiple
 * individual validation steps. If any of them returns false,
 * the validation fails
 *
 * @param   {Object} config parsed permission config
 *
 * @public
 * @returns {Boolean|String} validationResult Only true is treated as pass.
 */
exports.validate = function( config ) {
	var validationStepResult;
	var key;

	for( key in validationSteps ) {
		validationStepResult = validationSteps[ key ]( config );

		if( validationStepResult !== true ) {
			return validationStepResult;
		}
	}

	return true;
};

/**
 * Checks if the configuration is an object
 *
 * @param   {Object} config parsed permission config
 *
 * @private
 * @returns {Boolean}
 */
validationSteps.isValidType = function( config ) {
	if( typeof config === 'object' ) {
		return true;
	} else {
		return 'config should be an object literal, but was of type ' + ( typeof config );
	}
};

/**
 * Makes sure all sections (record, event, rpc) are present
 *
 * @param   {Object} config parsed permission config
 *
 * @private
 * @returns {Boolean}
 */
validationSteps.hasRequiredTopLevelKeys = function( config ) {
	for( var key in SCHEMA ) {
		if( typeof config[ key ] !== 'object' ) {
			return 'missing configuration section "' + key + '"';
		}
	}

	return true;
};

/**
 * Makes sure no unsupported sections were added
 *
 * @param   {Object} config parsed permission config
 *
 * @private
 * @returns {Boolean}
 */
validationSteps.doesNotHaveAdditionalTopLevelKeys = function( config ) {
	for( var key in config ) {
		if( typeof SCHEMA[ key ] === 'undefined' ) {
			return 'unexpected configuration section "' + key + '"';
		}
	}

	return true;
};

/**
 * Checks if the configuration contains valid path definitions
 *
 * @param   {Object} config parsed permission config
 *
 * @private
 * @returns {Boolean}
 */
validationSteps.doesOnlyContainValidPaths = function( config ) {
	var key, path, result;

	for( key in SCHEMA ) {

		// Check empty
		if( Object.keys( config[ key ] ).length === 0 ) {
			return 'empty section "' + key + '"';
		}

		// Check valid
		for( path in config[ key ] ) {
			result = pathParser.validate( path );
			if( result !== true ) {
				return result + ' for path ' + path + ' in section ' + key;
			}
		}
	}

	return true;
};

/**
 * Each section must specify a generic permission ("*") that
 * will be applied if no other permission is applicable
 *
 * @param   {Object} config parsed permission config
 *
 * @private
 * @returns {Boolean}
 */
validationSteps.doesHaveRootEntries = function( config ) {
	var sectionName;

	for( sectionName in SCHEMA ) {
		if( !config[ sectionName ][ '*' ] ) {
			return 'missing root entry "*" for section ' + sectionName;
		}
	}

	return true;
};

/**
 * Runs the rule validator against every rule in each section
 *
 * @param   {Object} config parsed permission config
 *
 * @private
 * @returns {Boolean}
 */
validationSteps.hasValidRules = function( config ) {
	var key, path, ruleType, section, validationResult;

	for( section in config ) {
		for( path in config[ section ] ) {
			for( ruleType in config[ section ][ path ] ) {
				if( SCHEMA[ section ][ ruleType ] !== true ) {
					return 'unknown rule type ' + ruleType + ' in section ' + section;
				}

				validationResult = ruleParser.validate( config[ section ][ path ][ ruleType ], section, ruleType );
				if( validationResult !== true ) {
					return validationResult;
				}
			}
		}
	}

	return true;
};