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
	var clientIndex = i++;
	socketMock.once( 'close', this._onClose.bind( this, clientIndex ) );
	this.clients[ clientIndex ] = socketMock;
	this.clientsCount++;
	this.emit( 'connection', socketMock );
	return socketMock;
};

EngineIoMock.prototype.listen = function(){
	return this;
};

EngineIoMock.prototype.attach = function( server ){
	return this;
};

EngineIoMock.prototype._onClose = function( clientIndex ) {
	delete this.clients[ clientIndex ];
	this.clientsCount--;
};

EngineIoMock.prototype.close = function(){
	for( var clientIndex in this.clients ) {
		this.clients[ clientIndex ].close();
	}
};

module.exports = new EngineIoMock();