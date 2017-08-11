const C = require('../constants/constants')
const SocketWrapper = require('../message/socket-wrapper')

class SubscriptionRegistry {
  constructor (options, topic) {
    this._names = new Map()
    this._broadcastTimeoutTime = options.broadcastTimeout || 0
    this._broadcastTimeout = null
    this._pending = []
    this._subscriptions = new Map()
    this._options = options
    this._topic = topic
    this._onBroadcastTimeout = this._onBroadcastTimeout.bind(this)
    this._onSocketClose = this._onSocketClose.bind(this)
  }

  onSubscriptionAdded () {

  }

  onSubscriptionRemoved () {

  }

  getNames () {
    return this._subscriptions.keys()
  }

  hasName (name) {
    return this._subscriptions.has(name)
  }

  getSubscribers (name) {
    const subscription = this._subscriptions.get(name)
    return subscription ? subscription.sockets : new Set()
  }

  subscribe (name, socket, silent) {
    const subscription = this._subscriptions.get(name) || {
      shared: '',
      senders: new Map(),
      sockets: new Set()
    }

    if (subscription.sockets.size === 0) {
      this._subscriptions.set(name, subscription)
    } else if (subscription.sockets.has(socket)) {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        C.EVENT.MULTIPLE_SUBSCRIPTIONS,
        `repeat supscription to "${name}" by ${socket.user}`
      )
      socket.sendError(this._topic, C.EVENT.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    subscription.sockets.add(socket)

    const names = this._names.get(socket) || new Set()
    if (names.size === 0) {
      this._names.set(socket, names)
      socket.once('close', this._onSocketClose)
    }
    names.add(name)

    this.onSubscriptionAdded(
      name,
      socket,
      subscription.sockets.size
    )

    if (!silent) {
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        C.EVENT.SUBSCRIBE,
        `for ${this._topic}:${name} by ${socket.user}`
      )
    }

    return subscription.sockets.size
  }

  unsubscribe (name, socket, silent) {
    const subscription = this._subscriptions.get(name)

    if (!subscription || !subscription.sockets.delete(socket)) {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        C.EVENT.NOT_SUBSCRIBED,
        `${socket.user} is not subscribed to ${name}`
      )
      socket.sendError(this._topic, C.EVENT.NOT_SUBSCRIBED, name)
      return
    }

    if (subscription.sockets.size === 0) {
      this._subscriptions.delete(name)
      this._pending.splice(this._pending.indexOf(subscription), 1)
    } else {
      subscription.senders.delete(socket)
    }

    const names = this._names.get(socket)
    names.delete(name)

    this.onSubscriptionRemoved(
      name,
      socket,
      subscription.sockets.size
    )

    if (!silent) {
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        C.EVENT.UNSUBSCRIBE,
        `for ${this._topic}:${name} by ${socket.user}`
      )
    }

    return subscription.sockets.size
  }

  sendToSubscribers (name, msg, socket) {
    if (!msg) {
      return
    }

    const subscription = this._subscriptions.get(name)

    if (!subscription) {
      return
    }

    // not all messages are valid, this should be fixed elsewhere!
    if (msg.charAt(msg.length - 1) !== C.MESSAGE_SEPERATOR) {
      msg += C.MESSAGE_SEPERATOR
    }

    if (subscription.shared.length === 0) {
      this._pending.push(subscription)
    }

    // append this message to the sharedMessage, the message that
    // is shared in the broadcast to every listener-only
    const start = subscription.shared.length
    subscription.shared += msg
    const stop = subscription.shared.length

    if (socket) {
      const gaps = subscription.senders.get(socket) || []

      if (gaps.length === 0) {
        subscription.senders.set(socket, gaps)
      }

      gaps.push(start, stop)
    }

    if (!this._broadcastTimeout) {
      this._broadcastTimeout = setTimeout(this._onBroadcastTimeout, this._broadcastTimeoutTime)
    }
  }

  _onSocketClose (socket) {
    for (const name of this._names.get(socket)) {
      this.unsubscribe(name, socket, true)
    }
    this._names.delete(socket)
  }

  _onBroadcastTimeout () {
    this._broadcastTimeout = null

    for (const subscription of this._pending) {
      const { senders, shared, sockets } = subscription

      for (const [ socket, gaps ] of senders) {
        let i = 0
        let message = shared.substring(0, gaps[i++])
        let lastStop = gaps[i++]

        while (i < gaps.length) {
          message += shared.substring(lastStop, gaps[i++])
          lastStop = gaps[i++]
        }
        message += shared.substring(lastStop, shared.length)

        socket.sendNative(message)
      }

      const preparedMessage = SocketWrapper.prepareMessage(shared)
      for (const socket of sockets) {
        if (!senders.has(socket)) {
          socket.sendPrepared(preparedMessage)
        }
      }
      SocketWrapper.finalizeMessage(preparedMessage)

      subscription.shared = ''
      subscription.senders.clear()
    }

    this._pending.length = 0
  }
}

module.exports = SubscriptionRegistry
