var rulesMap = require( './rules-map' );

var FUNCTION_REGEXP = /([\w]+)\(/g;
var NEW_REGEXP = /(^|[^\w~])new[^\w~]/;
var OLD_DATA_REGEXP = /(^|[^\w~])oldData[^\w~]/;
var DATA_REGEXP = /(^|[^\w~])data[^\w~]/;
var CROSS_REFERENCE_REGEXP = /(^|[^\w~])_[^\w~]/;

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

/**
 * Validates a rule. Makes sure that the rule is either a boolean or a string,
 * that it doesn't contain the new keyword or unsupported function invocations
 * and that it can be compiled into a javascript function
 *
 * @param   {String|Boolean} rule the rule as read from permissions.json
 * @param 	{String} section record, event or rpc
 * @param 	{String} type read, write, publish, subscribe etc...
 *
 * @public
 * @returns {Boolean} isValid
 */
exports.validate = function( rule, section, type ) {
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

	//TODO _ cross references are only supported for section record
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

	if( !!rule.match( OLD_DATA_REGEXP ) && !rulesMap.supportsOldData( type ) ) {
		return 'rule ' + type + ' for ' + section + ' does not support oldData';
	}

	if( !!rule.match( DATA_REGEXP ) && !rulesMap.supportsData( type ) ) {
		return 'rule ' + type + ' for ' + section + ' does not support data';
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
	if( rule === true || rule === false ) {
		return {
			fn: rule === true ? function(){ return true; } : function(){ return false; },
			hasOldData: false,
			hasData: false
		};
	}
	var ruleObj = {};
	var args = [ '_', 'user', 'data', 'oldData', 'now', 'action' ].concat( variables );
	args.push( 'return ' + rule + ';' );

	ruleObj.fn = Function.apply( this, args );
	ruleObj.hasOldData = !!rule.match( OLD_DATA_REGEXP );
	ruleObj.hasData = !!rule.match( DATA_REGEXP );

	return ruleObj;
};