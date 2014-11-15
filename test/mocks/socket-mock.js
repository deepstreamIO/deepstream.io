var SocketMock = function(){
	this.lastSendMessage = null;
	this.isDisconnected = false;
};

require("util").inherits( SocketMock, require("events").EventEmitter );

SocketMock.prototype.send = function( message ) {
	this.lastSendMessage = message;
};

SocketMock.prototype.disconnect = function() {
	this.isDisconnected = true;
};

exports.SocketMock = SocketMock;