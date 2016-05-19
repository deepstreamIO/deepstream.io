var WILDCARD_REGEXP = /\*/g;
var WILDCARD_STRING = '.*';
var VARIABLE_REGEXP = /(\$[a-zA-Z0-9]+)/g;
var VARIABLE_STRING = '([^\/]+)';
var INVALID_VARIABLE_REGEXP = /(\$[^a-zA-Z0-9])/;

/**
 * Checks a path for type and basic syntax errors
 *
 * @param   {String} path The path as specified in permission.json
 *
 * @public
 * @returns {String|Boolean} true if path is valid, string error message if not
 */
exports.validate = function( path ) {
	if( typeof path !== 'string' ) {
		return 'path must be a string';
	}

	if( path.length === 0 ) {
		return 'path can\'t be empty';
	}

	if( path[ 0 ] === '/' ){
		return 'path can\'t start with /';
	}

	var invalidVariableNames = path.match( INVALID_VARIABLE_REGEXP );

	if( invalidVariableNames !== null ) {
		return 'invalid variable name ' + invalidVariableNames[ 0 ];
	}

	return true;
};

/**
 * Parses a path and returns a regexp matcher with capture groups for
 * variable names and a list of variable names in the same order.
 * The path is assumed to be valid when its passed to this method
 *
 * @param   {String} path The path as specified in permission.json
 *
 * @public
 * @returns {Object} { variables: <String variableNames>[], regexp: <RegExp>}
 */
exports.parse = function( path ) {
	var variables = [];
	var regExp = path.replace( WILDCARD_REGEXP, WILDCARD_STRING );

	regExp = regExp.replace( VARIABLE_REGEXP, function( variableName ){
		variables.push( variableName );
		return VARIABLE_STRING;
	});

	return {
		variables: variables,
		path: path,
		regexp: new RegExp( '^' + regExp + '$' )
	};
};
