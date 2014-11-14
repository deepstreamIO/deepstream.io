exports.isValidUser = function( handshakeData, authData, callback ) {
	callback( null, authData.username || 'open' );
};

exports.canPerformAction = function( user, subject, action, callback ) {
	callback( null, true );
};