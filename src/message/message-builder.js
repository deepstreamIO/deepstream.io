var constants = require( '../constants/constants' ),
	SEP = constants.MESSAGE_PART_SEPERATOR;

exports.getErrorMsg = function( topic, type, message ) {
	return topic + SEP + 'E' + SEP + type + SEP + message;
};

exports.getMsg = function( topic, action, data ) {
	var sendData = [ topic, action ],
		i;

	if( data ) {
		for( i = 0; i < data.length; i++ ) {
			if( typeof data[ i ] === 'object' ) {
				sendData.push( JSON.stringify( data[ i ] ) );
			} else {
				sendData.push( data[ i ] );
			}
		}
	}

	return sendData.join( SEP );
};