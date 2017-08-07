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
    this._subscriptionListener = {
      onSubscriptionAdded: () => {},
      onSubscriptionRemoved: () => {}
    }
    this._constants = {
      MULTIPLE_SUBSCRIPTIONS: C.EVENT.MULTIPLE_SUBSCRIPTIONS,
      SUBSCRIBE: C.ACTIONS.SUBSCRIBE,
      UNSUBSCRIBE: C.ACTIONS.UNSUBSCRIBE,
      NOT_SUBSCRIBED: C.EVENT.NOT_SUBSCRIBED
    }
    this._onBroadcastTimeout = this._onBroadcastTimeout.bind(this)
    this._onSocketClose = this._onSocketClose.bind(this)
  }

  getNames () {
    return this._subscriptions.keys()
  }

  hasName (subscriptionName) {
    return this._subscriptions.has(subscriptionName)
  }

  getSubscribers (name) {
    const subscription = this._subscriptions.get(name)
    return subscription ? subscription.sockets : new Set()
  }

  setAction (name, value) {
    this._constants[name.toUpperCase()] = value
  }

  setSubscriptionListener (subscriptionListener) {
    this._subscriptionListener = subscriptionListener
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
        this._constants.MULTIPLE_SUBSCRIPTIONS,
        `repeat supscription to "${name}" by ${socket.user}`
      )
      socket.sendError(this._topic, this._constants.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    subscription.sockets.add(socket)

    const names = this._names.get(socket) || new Set()
    if (names.size === 0) {
      this._names.set(socket, names)
      socket.once('close', this._onSocketClose)
    }
    names.add(name)

    this._subscriptionListener.onSubscriptionAdded(
      name,
      socket,
      subscription.sockets.size
    )

    if (silent) {
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        this._constants.SUBSCRIBE,
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
        this._constants.NOT_SUBSCRIBED,
        `${socket.user} is not subscribed to ${name}`
      )
      socket.sendError(this._topic, this._constants.NOT_SUBSCRIBED, name)
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

    if (names.size === 0) {
      this._names.delete(socket)
      socket.removeListener('close', this._onSocketClose)
    }

    this._subscriptionListener.onSubscriptionRemoved(
      name,
      socket,
      subscription.sockets.size
    )

    if (!silent) {
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        this._constants.UNSUBSCRIBE,
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

    if (!socket) {
      return
    }

    const gaps = subscription.senders.get(socket) || []

    if (gaps.length === 0) {
      subscription.senders.set(socket, gaps)
    }

    gaps.push(start, stop)

    if (!this._broadcastTimeout) {
      this._broadcastTimeout = setTimeout(this._onBroadcastTimeout, this._broadcastTimeoutTime)
    }
  }

  _onSocketClose (socket) {
    for (const name of this._names.get(socket)) {
      this.unsubscribe(name, socket, true)
    }
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
