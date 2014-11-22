C = require( '../../src/constants/constants' );

exports.msg = function( input ) {
	return input.replace( /\|/g, C.MESSAGE_PART_SEPERATOR );
};