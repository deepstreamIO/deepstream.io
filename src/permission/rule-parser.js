var FUNCTION_REGEXP = /([a-zA-Z0-9_]*)\(/g;
var NEW_REGEXP = /^new[^a-zA-Z0-9^]|[^a-zA-Z0-9^]new[^a-zA-Z0-9]/;
var OLD_DATA_REGEXP = /^oldData[^a-zA-Z0-9^]|[^a-zA-Z0-9^]oldData[^a-zA-Z0-9]/;
var CROSS_REFERENCE_REGEXP = /^_[^a-zA-Z0-9^]|[^a-zA-Z0-9^]_[^a-zA-Z0-9]/;
var SUPPORTED_FUNCTIONS = [
	'_',
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
	if( typeof rule === 'boolean' ) {
		return true;
	}
	
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

	try{
		new Function( rule ); //jshint ignore:line
	} catch( e ) {
		return e.toString();
	}

	return true;
};

/**
 * Cross References:
 *
 * Cross references are denoted with an underscore function _()
 * They can take path variables: _($someId)
 * variables from data: _(data.someValue)
 * or strings: _('user/egon')
 *
 * @param   {[type]} rule      [description]
 * @param   {[type]} variables [description]
 *
 * @returns {[type]}
 */
exports.parse = function( rule, variables ) {
	var ruleObj = {};
	var args = variables.slice( 0 );

	args.unshift( '_' );
	args.push( rule );

	ruleObj.fn = Function.apply(this, args );
	ruleObj.hasOldData = !!rule.match( OLD_DATA_REGEXP );
};