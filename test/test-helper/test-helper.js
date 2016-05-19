var C = require( '../../src/constants/constants' );

exports.msg = function( input ) {
	var result = [], i;

	for( i = 0; i < arguments.length; i++ ) {
		result.push( arguments[ i ]
			.replace( /\|/g, C.MESSAGE_PART_SEPERATOR )
			.replace( /\+/g, C.MESSAGE_SEPERATOR )
		);
	}

	return result.join( C.MESSAGE_SEPERATOR );
};

exports.showChars = function( input ) {
	return input
		.replace( new RegExp( String.fromCharCode( 31 ), 'g' ), '|' )
		.replace( new RegExp( String.fromCharCode( 30 ), 'g' ), '+' );
};

exports.getBasePermissions = function() {
	return {
		"record": {
			"*": {
				"write": true,
				"read": true
			}
		},
		"event": {
			"*": {
				"publish": true,
				"subscribe": true
			}
		},
		"rpc": {
			"*": {
				"provide": true,
				"request": true
			}
		}
	};
};