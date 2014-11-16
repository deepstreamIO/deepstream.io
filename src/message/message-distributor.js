var C = require( '../constants/constants' );

var MessageDistributor = function() {
	this._callbacks = {};
};

MessageDistributor.prototype.distribute = function( socketWrapper, message ) {
	if( this._callbacks[ message.topic ] === undefined ) {
		socketWrapper.sendError( C.TOPIC.ERROR, C.EVENT.UNKNOWN_TOPIC, message.topic );
	}

	this._callbacks[ message.topic ]( socketWrapper, message );
};

MessageDistributor.prototype.registerForTopic = function( topic, callback ) {
	if( this._callbacks[ topic ] !== undefined ) {
		throw new Error( 'Callback already registered for topic ' + topic );
	}

	this._callbacks[ topic ] = callback;
};

module.exports = MessageDistributor;