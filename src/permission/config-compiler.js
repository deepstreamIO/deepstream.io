var pathParser = require( './path-parser' );
var ruleParser = require( './rule-parser' );

/**
 * Compiles a pre-validated config into a format that allows for quicker access
 * and execution
 *
 * @param   {Object} config parsed and validated permission config
 *
 * @public
 * @returns {Object} compiledConfig
 */
exports.compile = function( config ) {
	var compiledConfig = {};
	var compiledRuleset, section, path;

	for( section in config ) {

		compiledConfig[ section ] = [];

		for( path in config[ section ] ) {
			compiledRuleset = compileRuleset( path, config[ section ][ path ] );
			compiledConfig[ section ].push( compiledRuleset );
		}
	}

	return compiledConfig;
};

/**
 * Compiles an individual ruleset
 *
 * @param   {String} path
 * @param   {Object} rules
 *
 * @private
 * @returns {Object} compiledRuleset
 */
function compileRuleset( path, rules ) {
	var ruleset = pathParser.parse( path );

	ruleset.rules = {};

	for( var ruleType in rules ) {
		ruleset.rules[ ruleType ] = ruleParser.parse(
			rules[ ruleType ], ruleset.variables
		);
	}

	return ruleset;
}