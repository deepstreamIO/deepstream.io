var EventEmitter = require('events').EventEmitter;
var util = require('util');

var HttpServerMock = function() {
	EventEmitter.call(this);
	this.listening = false;
	this.closed = false;
};

util.inherits(HttpServerMock, EventEmitter);

HttpServerMock.prototype.listen = function ( port, host, callback ) {
	this._port = port;
	this._host = host;
	var server = this;
	process.nextTick( function() {
		server.listening = true;
		server.emit('listening');
		callback && callback();
	});
};

HttpServerMock.prototype.close = function( callback ) {
	this.closed = true;
	this.emit('close');
	callback && callback();
};

HttpServerMock.prototype.address = function() {
	return {
		address: this._host,
		port: this._port
	};
};

var HttpMock = function(){
	this.nextServerIsListening = false;
};

HttpMock.prototype.createServer = function() {
	var server = new HttpServerMock();
	server.listening = this.nextServerIsListening;
	return server;
};

module.exports = HttpMock;