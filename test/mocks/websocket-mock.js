var SocketMock = require( './socket-mock' );

var i=0;
var websocketMock = null;

var WebsocketMock = function(){
	this.clients = {};
	this.clientsCount = 0;
	this.setMaxListeners( 0 );
	websocketMock = this;
};

require("util").inherits( WebsocketMock, require("events").EventEmitter );

WebsocketMock.prototype.simulateConnection = function() {
	var socketMock = new SocketMock();
	var clientIndex = i++;
	socketMock.once( 'close', this._onClose.bind( this, clientIndex ) );
	this.clients[ clientIndex ] = socketMock;
	this.clientsCount++;
	this.emit( 'connection', socketMock );
	return socketMock;
};

WebsocketMock.prototype.Server = function(){
	return websocketMock;
};

WebsocketMock.prototype._onClose = function( clientIndex ) {
	delete this.clients[ clientIndex ];
	this.clientsCount--;
};

WebsocketMock.prototype.close = function(){
	for( var clientIndex in this.clients ) {
		this.clients[ clientIndex ].close();
	}
};

module.exports = new WebsocketMock();