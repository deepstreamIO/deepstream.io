var constants = require( '../constants/constants' ),
	SEP = constants.MESSAGE_PART_SEPERATOR;

/**
 * Creates a deepstream message string, based on the 
 * provided parameters
 *
 * @param   {String} topic  One of CONSTANTS.TOPIC
 * @param   {String} action One of CONSTANTS.ACTIONS
 * @param   {Array} data An array of strings or JSON-serializable objects
 *
 * @returns {String} deepstream message string
 */
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

/**
 * Creates a deepstream error message string based on the provided
 * arguments
 *
 * @param   {String} topic   One of CONSTANTS.TOPIC - error messages might either be send on
 *                           the generic ERROR topic or on the topic that caused the error
 *                           
 * @param   {String} type    One of CONSTANTS.EVENT
 * @param   {String} message A generic error message
 *
 * @returns {String} deepstream error message string
 */
exports.getErrorMsg = function( topic, type, message ) {
	return topic + SEP + 'E' + SEP + type + SEP + message;
};

