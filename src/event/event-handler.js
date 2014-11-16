var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' );

var EventHandler = function( connectionEndpoint, options ) {
	this._connectionEndpoint = connectionEndpoint;
	this._subscriptionRegistry = new SubscriptionRegistry( options );
};

EventHandler.prototype.handle = function( socketWrapper, message ) {
	if( message.action === C.ACTIONS.SUBSCRIBE ) {

	}
// exports.ACTIONS.SUBSCRIBE = 'S';
// exports.ACTIONS.UNSUBSCRIBE = 'US';

};

module.exports = EventHandler;