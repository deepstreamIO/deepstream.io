var messageParser = require( './message-parser' ),
	C = require( '../constants/constants' );

var MessageProcessor = function( options ) {
	this._options = options;
};

MessageProcessor.prototype.onAuthenticatedMessage = function( socketWrapper, message ){};

MessageProcessor.prototype.process = function( socketWrapper, message ) {
	var parsedMessages = messageParser.parse( message ),
		i;

	for( i = 0; i < parsedMessages.length; i++ ) {
		
		if( parsedMessages[ i ] === null ) {
			socketWrapper.sendError( C.TOPIC.ERROR, C.EVENT.MESSAGE_PARSE_ERROR, message );
			continue;
		}

		this._options.permissionHandler.canPerformAction( 
			socketWrapper.user, 
			parsedMessages[ i ], 
			this._onPermissionResponse.bind( this, socketWrapper, parsedMessages[ i ] ) 
		);
	}
};

MessageProcessor.prototype._onPermissionResponse = function( socketWrapper, message, error, result ) {
	if( error !== null ) {
		socketWrapper.sendError( message.topic, C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString() );
		return;
	}

	if( result !== true ) {
		socketWrapper.sendError( message.topic, C.EVENT.MESSAGE_DENIED, message.raw );
		return;
	}

	this.onAuthenticatedMessage( socketWrapper, message );
};

module.exports = MessageProcessor;