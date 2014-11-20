var C = require( '../constants/constants' ),
	utils = require( '../utils/utils' );

/**
 * Makes a remote procedure call to provider and returns
 * the result to requestor.
 *
 * @param {String|SocketWrapper} requestor SocketWrapper if requested locally, 
 *                                         C.SOURCE_MESSAGE_CONNECTOR if requested
 *                                         by the message connector
 * @param {SocketWrapper} provider  A local socket, able to provide the rpc
 * @param {String} rpcName
 * @param {Object} rpcData
 */
var LocalRpc = function( requestor, provider, rpcName, rpcData ) {
	this.correlationId = rpcData.correlationId;
	console.log( arguments );
	this._requestor = requestor;
	this._provider = provider;
	this._rpcName = rpcName;
	this._rpcData = rpcData;
	this._onProviderResponseFn = this._processProviderMessage.bind( this );

	this._ackTimeout = setTimeout(function() {}, 10);
	this._provider.on( C.TOPIC.RPC, this._onProviderResponseFn );
	this._provider.sendMessage( C.TOPIC.RPC, C.ACTIONS.RPC, [ rpcName, rpcData ] );
	
};

LocalRpc.prototype._onProviderResponse = function( message ) {
	if( message.action === C.ACTIONS.ACK && message.data[ 0 ] === this.correlationId ) {
		
	}
};

module.exports = LocalRpc;