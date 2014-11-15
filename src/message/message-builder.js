var constants = require( '../constants/constants' ),
	SEP = constants.MESSAGE_PART_SEPERATOR;

exports.getErrorMsg = function( topic, type, message ) {
	return topic + SEP + 'E' + SEP + type + SEP + message;
};