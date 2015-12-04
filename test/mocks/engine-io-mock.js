var SocketMock = require( './socket-mock' );

var EngineIoMock = function(){
	this.clients = [];
};

require("util").inherits( EngineIoMock, require("events").EventEmitter );

EngineIoMock.prototype.simulateConnection = function() {
	var socketMock = new SocketMock();
	this.emit( 'connection', socketMock );
	this.clients.push( socketMock );
	return socketMock;
};

EngineIoMock.prototype.listen = function(){
	return this;
};

EngineIoMock.prototype.attach = function( server ){
	return this;
};

EngineIoMock.prototype.close = function(){
	for( var i=0; i<this.clients.length; i++){
		this.clients[i].close();
	}
};

module.exports = new EngineIoMock();