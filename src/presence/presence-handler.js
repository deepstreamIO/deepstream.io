const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class PresenceHandler {
  constructor (options) {
    this._options = options
    this._localClients = new Map()
    this._connectionEndpoint = options.connectionEndpoint
    this._connectionEndpoint.on('client-connected', this._handleJoin.bind(this))
    this._connectionEndpoint.on('client-disconnected', this._handleLeave.bind(this))

    this._presenceRegistry = new SubscriptionRegistry(options, C.TOPIC.PRESENCE)
  }

  handle (socket, message) {
    if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._presenceRegistry.subscribe(C.TOPIC.PRESENCE, socket)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._presenceRegistry.unsubscribe(C.TOPIC.PRESENCE, socket)
    } else if (message.action === C.ACTIONS.QUERY) {
      this._handleQuery(socket)
    } else {
      socket.sendError(C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, [
        ...(message ? message.data : []),
        `unknown action ${message.action}`
      ])
    }
  }

  _handleJoin (socket) {
    const currentCount = this._localClients.get(socket.user)
    if (!currentCount) {
      this._localClients.set(socket.user, 1)
      this._onClientAdded(socket.user)
    } else {
      this._localClients.set(socket.user, currentCount + 1)
    }
  }

  _handleLeave (socket) {
    const currentCount = this._localClients.get(socket.user)
    if (currentCount === 1) {
      this._localClients.delete(socket.user)
      this._onClientRemoved(socket.user)
    } else {
      this._localClients.set(socket.user, currentCount - 1)
    }
  }

  _handleQuery (socket) {
    const clients = Array.from(this._localClients.values())
    const index = clients.indexOf(socket.user)
    if (index !== -1) {
      clients.splice(index, 1)
    }
    socket.sendMessage(C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients)
  }

  _onClientAdded (username) {
    this._presenceRegistry.sendToSubscribers(
      C.TOPIC.PRESENCE,
      messageBuilder.getMsg(C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_JOIN, [ username ])
    )
  }

  _onClientRemoved (username) {
    this._presenceRegistry.sendToSubscribers(
      C.TOPIC.PRESENCE,
      messageBuilder.getMsg(C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_LEAVE, [ username ])
    )
  }
}
