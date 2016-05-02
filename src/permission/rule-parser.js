var FUNCTION_REGEXP = /([a-zA-Z0-9]*)\(/g;
var NEW_REGEXP = /[^a-zA-Z0-9^]new[^a-zA-Z0-9]/;
var SUPPORTED_FUNCTIONS = [
	'&',
	'startsWith',
	'endsWith',
	'includes',
	'indexOf',
	'match',
	'toUpperCase',
	'toLowerCase',
	'trim'
];

//charAt

exports.validate = function( rule ) {
	if( typeof rule !== 'string' ) {
		return 'rule must be a string';
	}

	if( rule.length === 0 ) {
		return 'rule can\'t be empty';
	}

	if( rule.match( NEW_REGEXP ) ) {
		return 'rule can\'t contain the new keyword';
	}

	var functions = rule.match( FUNCTION_REGEXP );
	var functionName;
	var i;

	if( functions ) {
		for( i = 0; i < functions.length; i++ ) {
			functionName = functions[ i ].replace('(', '');
			if( SUPPORTED_FUNCTIONS.indexOf( functionName ) === -1 ) {
				return 'function ' + functionName + ' is not supported';
			}
		}
	}
	return true;
};

exports.parse = function( rule ) {

};