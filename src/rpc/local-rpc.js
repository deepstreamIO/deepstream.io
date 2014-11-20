C = require( '../constants/constants' );

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
	this._requestor = requestor;
	this._provider = provider;
	this._rpcName = rpcName;
	this._rpcData = rpcData;

	this._provider.sendMessage( C.TOPIC.RPC, ACTIONS.RPC, [ rpcName, rpcData ] );
};

LocalRpc.prototype._onProviderResponse = function() {

};

module.exports = LocalRpc;