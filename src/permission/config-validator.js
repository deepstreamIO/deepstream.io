var pathParser = require( './path-parser' );
var validationSteps = {};
var TOP_LEVEL_KEYS = [ 'record', 'event', 'rpc' ];

validationSteps.isValidType = function( config ) {
	if( typeof config === 'object' ) {
		return true;
	} else {
		return 'config should be an object literal, but was of type ' + ( typeof config );
	}
};


validationSteps.hasRequiredTOP_LEVEL_KEYS = function( config ) {
	for( var i = 0; i < TOP_LEVEL_KEYS.length; i++ ) {
		if( typeof config[ TOP_LEVEL_KEYS[ i ] ] !== 'object' ) {
			return 'missing configuration section "' + TOP_LEVEL_KEYS[ i ] + '"';
		}
	}

	return true;
};

validationSteps.doesNotHaveAdditionalTOP_LEVEL_KEYS = function( config ) {
	for( var key in config ) {
		if( TOP_LEVEL_KEYS.indexOf( key ) === -1 ) {
			return 'unexpected configuration section "' + key + '"';
		}
	}

	return true;
};

validationSteps.doesOnlyContainValidPaths = function( config ) {
	var i, path, result;

	for( i = 0; i < TOP_LEVEL_KEYS.length; i++ ) {

		// Check empty
		if( Object.keys( config[ TOP_LEVEL_KEYS[ i ] ] ).length === 0 ) {
			return 'empty section "' + TOP_LEVEL_KEYS[ i ] + '"';
		}

		// Check valid
		for( path in config[ TOP_LEVEL_KEYS[ i ] ] ) {
			result = pathParser.validate( path );
			if( result !== true ) {
				return result + ' for path ' + path + ' in section ' + TOP_LEVEL_KEYS[ i ];
			}
		}
	}

	return true;
};


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