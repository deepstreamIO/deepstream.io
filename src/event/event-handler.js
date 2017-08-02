'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')

const EventHandler = function (options) {
  this._options = options
  this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.EVENT)
  this._listenerRegistry = new ListenerRegistry(C.TOPIC.EVENT, options, this._subscriptionRegistry)
  this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)
  this._logger = options.logger
}

EventHandler.prototype.handle = function (socket, message) {
  if (message.action === C.ACTIONS.SUBSCRIBE) {
    this._subscriptionRegistry.subscribe(message.data[0], socket)
  } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
    this._subscriptionRegistry.unsubscribe(message.data[0], socket)
  } else if (message.action === C.ACTIONS.EVENT) {
    this._trigger(socket, message)
  } else if (
    message.action === C.ACTIONS.LISTEN ||
    message.action === C.ACTIONS.UNLISTEN ||
    message.action === C.ACTIONS.LISTEN_ACCEPT ||
    message.action === C.ACTIONS.LISTEN_REJECT
  ) {
    this._listenerRegistry.handle(socket, message)
  } else {
    socket.sendError(C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, [
      ...(message ? message.data : []),
      `unknown action ${message.action}`
    ])
  }
}

EventHandler.prototype._trigger = function (socket, message) {
  if (typeof message.data[0] !== 'string') {
    this._sendError(socket, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
    return
  }

  this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.TRIGGER_EVENT, message.raw)

  this._subscriptionRegistry.sendToSubscribers(
    message.data[0],
    messageBuilder.getMsg(C.TOPIC.EVENT, C.ACTIONS.EVENT, message.data),
    socket
  )
}

module.exports = EventHandler
