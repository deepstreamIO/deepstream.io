var engineIo = require('engine.io');

var ConnectionEndpoint = function( engineIo, permissionHandler ) {
	this._permissionHandler = permissionHandler;
	this._endPoint = engineIo;
	this._endPoint.on( 'connection', this._onConnection.bind( this ) );
	this._timeout = null;
	this._msgNum = 0;
};

ConnectionEndpoint.prototype._authenticateConnection = function( socket, authMsg ) {
	console.log( 'received', authMsg );
	if( authMsg.substr( 0, 4 ) !== 'AUTH' ) {
		socket.error( 'invalid authentication message' );
		socket.disconnect( true );
	}

	console.log( '_authenticateConnection', authMsg, authMsg.length );
};

ConnectionEndpoint.prototype._onConnection = function( socket ) {
	socket.user = null;
	socket.authCallBack = this._authenticateConnection.bind( this, socket );
	socket.on( 'message', socket.authCallBack );
};

module.exports = ConnectionEndpoint;