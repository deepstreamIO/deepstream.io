var C = require( '../constants/constants' );

function readMessage( message ) {
	var TOPIC = C.TOPIC;
	var ACTIONS = C.ACTIONS;
	return {
		isRecord: message.topic === TOPIC.RECORD,
		isEvent: message.topic === TOPIC.EVENT,
		isRPC: message.topic === TOPIC.RPC,

		isCreate: message.action === ACTIONS.CREATEORREAD,
		isRead: message.action === ACTIONS.CREATEORREAD,
		isChange: (
			message.action === ACTIONS.PATCH || message.action === ACTIONS.UPDATE
		),
		isDelete: message.action === ACTIONS.DELETE,

		isAck: message.action === ACTIONS.ACK,
		isSubscribe: message.action === ACTIONS.SUBSCRIBE,
		isUnsubscribe: message.action === ACTIONS.UNSUBSCRIBE,
		isRequest: message.action === ACTIONS.REQUEST,
		isRejection: message.action === ACTIONS.REJECTION,

		name: message.data[ 0 ],
		path: message.action === ACTIONS.PATCH ? message.data[ 2 ] : undefined,
		data: message.action === ACTIONS.PATCH ? message.data[ 3 ] : message.data[ 2 ]
	};
}

module.exports = readMessage;
