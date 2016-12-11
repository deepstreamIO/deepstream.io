const C = require('../constants/constants')

function readMessage (message) {
  const TOPIC = C.TOPIC
  const ACTIONS = C.ACTIONS
  return {
    isRecord: message.topic === TOPIC.RECORD,
    isEvent: message.topic === TOPIC.EVENT,
    isRPC: message.topic === TOPIC.RPC,

    isRead: message.action === ACTIONS.READ,
    isChange: message.action === ACTIONS.UPDATE,
    isDelete: message.action === ACTIONS.DELETE,

    isAck: message.action === ACTIONS.ACK,
    isSubscribe: message.action === ACTIONS.SUBSCRIBE,
    isUnsubscribe: message.action === ACTIONS.UNSUBSCRIBE,
    isRequest: message.action === ACTIONS.REQUEST,
    isRejection: message.action === ACTIONS.REJECTION,

    name: message.data[ 0 ],
    data: message.data[ 2 ]
  }
}

module.exports = readMessage
