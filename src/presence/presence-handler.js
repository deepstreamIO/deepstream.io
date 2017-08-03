const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class PresenceHandler {
  constructor (options) {
    this._options = options
    this._users = new Map()
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
    const count = this._users.get(socket.user)
    if (!count) {
      this._users.set(socket.user, 1)
      this._presenceRegistry.sendToSubscribers(
        C.TOPIC.PRESENCE,
        messageBuilder.getMsg(C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_JOIN, [ socket.user ])
      )
    } else {
      this._users.set(socket.user, count + 1)
    }
  }

  _handleLeave (socket) {
    const count = this._users.get(socket.user)
    if (count === 1) {
      this._users.delete(socket.user)
      this._presenceRegistry.sendToSubscribers(
        C.TOPIC.PRESENCE,
        messageBuilder.getMsg(C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_LEAVE, [ socket.user ])
      )
    } else {
      this._users.set(socket.user, count - 1)
    }
  }

  _handleQuery (socket) {
    const clients = Array.from(this._users.keys())
    const index = clients.indexOf(socket.user)
    if (index !== -1) {
      clients.splice(index, 1)
    }
    socket.sendMessage(C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients)
  }
}
