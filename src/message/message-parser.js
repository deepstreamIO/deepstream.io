exports.parse = function( message ) {
	var parsedMessages = [],
		rawMessages = message.split( '♦' ),
		i;

	for( i = 0; i < rawMessages.length; i++ ) {
		parsedMessages.push( parseMessage( rawMessages[ i ] ) );
	}

	return parsedMessages;
};

var actions = {
	'C': 'create',
	'R': 'read',
	'U': 'update',
	'D': 'delete',
	'S': 'subscribe',
	'US': 'unsubscribe',
	'I': 'invoke',
	'L': 'listen',
	'P': 'provide',
	'UP': 'unprovide',
	'CR': 'createOrRead',
	'RPC': 'rpc',
	'EVT': 'event'
};

var parseMessage = function( message ) {
	var parts = message.split( '‡' ),
		messageObject = {};

	if( parts.length < 3 ) {
		return null;
	}

	messageObject.raw = message;
	messageObject.topic = parts[ 0 ];
	messageObject.action = actions[ parts[ 1 ] ];
	messageObject.data = parts.splice( 2 );

	return messageObject;
};