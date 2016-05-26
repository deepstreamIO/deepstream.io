var PermissionHandlerMock = function() {
	this.reset();
};

PermissionHandlerMock.prototype.reset = function() {
	this.nextUserValidationResult = true;
	this.lastUserValidationQueryArgs = null;
	this.nextCanPerformActionResult = true;
	this.lastCanPerformActionQueryArgs = null;
	this.sendNextValidAuthWithData = false;
	this.onClientDisconnectCalledWith = null;
};

PermissionHandlerMock.prototype.isValidUser = function( handshakeData, authData, callback ) {
	this.lastUserValidationQueryArgs = arguments;
	if( this.nextUserValidationResult === true ) {
		if( this.sendNextValidAuthWithData === true ) {
			callback( true, {
				username: 'test-user',
				clientData: 'test-data'
			});
		} else {
			callback( true, { username: 'test-user' });
		}
	} else {
		callback( false, { clientData: 'Invalid User' });
	}
};

PermissionHandlerMock.prototype.canPerformAction = function( username, message, callback) {
	this.lastCanPerformActionQueryArgs = arguments;
	if( typeof this.nextCanPerformActionResult === 'string' ) {
		callback( this.nextCanPerformActionResult );
	} else {
		callback( null, this.nextCanPerformActionResult );
	}
};

PermissionHandlerMock.prototype.onClientDisconnect = function( username ) {
	this.onClientDisconnectCalledWith = username;
};

module.exports = new PermissionHandlerMock();
