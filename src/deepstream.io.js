var ConnectionEndpoint = require( './message/connection-endpoint' );
var engine = require('engine.io');

var Deepstream = function() {
	this._options = require( './default-options' );
	this._connectionEndpoint = null;
	this._engineIo = null;
};

Deepstream.prototype.set = function( key, value ) {

};

Deepstream.prototype.start = function() {
	this._engineIo = engine.listen( this._options.port );//@TODO add host
	this._connectionEndpoint = new ConnectionEndpoint( this._engineIo, this._options.permissionHandler );
};

exports.Deepstream = Deepstream;