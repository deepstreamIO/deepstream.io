var validationSteps = {};
var topLevelKeys = [ 'record', 'event', 'rpc' ];

validationSteps.isValidType = function( config ) {
	if( typeof config === 'object' ) {
		return true;
	} else {
		return 'config should be an object literal, but was of type ' + ( typeof config );
	}
};


validationSteps.hasRequiredTopLevelKeys = function( config ) {
	for( var i = 0; i < topLevelKeys.length; i++ ) {
		if( typeof config[ topLevelKeys[ i ] ] !== 'object' ) {
			return 'missing configuration section "' + topLevelKeys[ i ] + '"';
		}
	}

	return true;
};

validationSteps.doesNotHaveAdditionalTopLevelKeys = function( config ) {
	for( var key in config ) {
		if( topLevelKeys.indexOf( key ) === -1 ) {
			return 'unexpected configuration section "' + key + '"';
		}
	}

	return true;
};

validationSteps.doesOnlyContainValidPaths = function() {
	return true; //TODO
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