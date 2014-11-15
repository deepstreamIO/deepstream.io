var messageBuilder = require( './message-builder' );

var SocketWrapper = function( socket ) {
	this.socket = socket;
	this.user = null;
	this.authCallBack = null;
	this.authAttempts = 0;
};

SocketWrapper.prototype.getHandshakeData = function() {
	return {
		headers: this.socket.headers,
		url: this.socket.url,
		method: this.socket.method,
		httpVersionMajor: this.socket.httpVersionMajor,
		httpVersionMinor: this.socket.httpVersionMinor
	};
};

SocketWrapper.prototype.sendError = function( topic, type, msg ) {
	this.socket.send( messageBuilder.getErrorMsg( topic, type, msg ) );
};

SocketWrapper.prototype.sendMessage = function( topic, type, data ) {
	this.socket.send( messageBuilder.getMsg( topic, type, data ) );
};

SocketWrapper.prototype.destroy = function() {
	this.socket.disconnect( true );
	this.socket.removeAllListeners();
	this.authCallBack = null;
};

module.exports = SocketWrapper;