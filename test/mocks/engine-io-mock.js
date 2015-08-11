var SocketMock = require( './socket-mock' );

var EngineIoMock = function(){};

require("util").inherits( EngineIoMock, require("events").EventEmitter );

EngineIoMock.prototype.simulateConnection = function() {
	var socketMock = new SocketMock();
	this.emit( 'connection', socketMock );
	return socketMock;
};

EngineIoMock.prototype.listen = function(){
	return this;
};

EngineIoMock.prototype.attach = function( server ){
	return this;
};

module.exports = new EngineIoMock();