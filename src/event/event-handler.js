const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')

module.exports = class EventHandler {
  constructor (options) {
    this._options = options
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.EVENT)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.EVENT, options, this._subscriptionRegistry)
    this._logger = options.logger
  }

  handle (socket, message, rawMessage) {
    const [ , action, pattern ] = rawMessage.split(C.MESSAGE_PART_SEPERATOR, 3)

    if (
      action === C.ACTIONS.LISTEN ||
      action === C.ACTIONS.UNLISTEN ||
      action === C.ACTIONS.LISTEN_ACCEPT ||
      action === C.ACTIONS.LISTEN_REJECT
    ) {
      this._listenerRegistry.handle(socket, message, rawMessage)
      return
    }

    if (action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(pattern, socket)
    } else if (action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(pattern, socket)
    } else if (action === C.ACTIONS.EVENT) {
      this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.TRIGGER_EVENT, rawMessage)
      this._subscriptionRegistry.sendToSubscribers(pattern, rawMessage, socket)
    } else {
      socket.sendError(null, C.EVENT.UNKNOWN_ACTION, message)
    }
  }
}
