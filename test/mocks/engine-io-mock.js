var SocketMock = require( './socket-mock' ).SocketMock;

var EngineIoMock = function(){};

require("util").inherits( EngineIoMock, require("events").EventEmitter );

EngineIoMock.prototype.simulateConnection = function() {
	var socketMock = new SocketMock();
	this.emit( 'connection', socketMock );
	return socketMock;
};

module.exports = new EngineIoMock();