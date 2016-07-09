var AuthenticationHandlerMock = function() {
	this.reset();
};

AuthenticationHandlerMock.prototype.reset = function() {
	this.nextUserValidationResult = true;
	this.lastUserValidationQueryArgs = null;
	this.sendNextValidAuthWithData = false;
	this.onClientDisconnectCalledWith = null;
};

AuthenticationHandlerMock.prototype.isValidUser = function( handshakeData, authData, callback ) {
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

AuthenticationHandlerMock.prototype.onClientDisconnect = function( username ) {
	this.onClientDisconnectCalledWith = username;
};

module.exports = new AuthenticationHandlerMock();
