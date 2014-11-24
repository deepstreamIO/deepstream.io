var C = require( '../constants/constants' ),
	events = require( 'events' ),
	utils = require( 'util' );

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky bugger.
 *
 * @constructor
 */
var RemoteRpcProviderProxy = function( options, privateTopic ) {
	this._options = options;
	this._privateTopic = privateTopic;
};

utils.inherits( RemoteRpcProviderProxy, events.EventEmitter );

module.exports = RemoteRpcProviderProxy;