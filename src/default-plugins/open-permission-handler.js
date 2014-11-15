exports.isValidUser = function( handshakeData, authData, callback ) {
	callback( null, authData.username || 'open' );
};

exports.canPerformAction = function( username, message, callback ) {
	callback( null, true );
};