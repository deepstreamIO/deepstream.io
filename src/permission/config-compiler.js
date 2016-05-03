var pathParser = require( './path-parser' );
var ruleParser = require( './rule-parser' );

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