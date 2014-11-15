var PermissionHandlerMock = function() {
	this.nextUserValidationResult = true;
	this.lastUserValidationQueryArgs = null;
};

PermissionHandlerMock.prototype.isValidUser = function( handshakeData, authData, callback ) {
	this.lastUserValidationQueryArgs = arguments;
	if( this.nextUserValidationResult === true ) {
		callback( null, 'test-user' );
	} else {
		callback( 'Invalid User' );
	}
};

module.exports = new PermissionHandlerMock();