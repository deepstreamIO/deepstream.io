var SocketMock = function(){
	this.lastSendMessage = null;
	this.isDisconnected = false;
	this.sendMessages = [];
	this.readyState = "";
};

require("util").inherits( SocketMock, require("events").EventEmitter );

SocketMock.prototype.send = function( message ) {
	this.lastSendMessage = message;
	this.sendMessages.push( message );
};

SocketMock.prototype.getMsg = function( i ) {
	return this.sendMessages[ this.sendMessages.length - ( i + 1 ) ];	
};

SocketMock.prototype.close = function() {
	this.isDisconnected = true;
	this.readyState = 'closed';
	this.emit( 'close' );
};

module.exports = SocketMock;