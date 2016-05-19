var SocketMock = require( './socket-mock' );

var i=0;

var EngineIoMock = function(){
	this.clients = {};
	this.clientsCount = 0;
	this.setMaxListeners( 0 );
};

require("util").inherits( EngineIoMock, require("events").EventEmitter );

EngineIoMock.prototype.simulateConnection = function() {
	var socketMock = new SocketMock();
	this.emit( 'connection', socketMock );
	this.clients[ i++ ] =  socketMock;
	this.clientsCount++;
	return socketMock;
};

EngineIoMock.prototype.listen = function(){
	return this;
};

EngineIoMock.prototype.attach = function( server ){
	return this;
};

EngineIoMock.prototype.close = function(){
	for( var client in this.clients ) {
		this.clients[ client ].close();
		this.clientsCount--;
	}
	this.clients = {};
};

module.exports = new EngineIoMock();