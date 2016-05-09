var EventEmitter = require('events').EventEmitter;
var util = require('util');

var TcpEndpointMock = function() {
	this.isClosed = false;
};

util.inherits( TcpEndpointMock, EventEmitter );

TcpEndpointMock.prototype.close = function() {
	setTimeout(function(){
		this.isClosed = true;
		this.emit( 'close' );
	}.bind( this ), 1);
};

module.exports = TcpEndpointMock;