const C = require('../constants/constants')
const SocketWrapper = require('../message/socket-wrapper')

class SubscriptionRegistry {
  constructor (options, topic) {
    this._delayedBroadcasts = new Map()
    this._names = new Map()
    this._subscriptions = new Map()
    this._options = options
    this._topic = topic
    this._subscriptionListener = null
    this._constants = {
      MULTIPLE_SUBSCRIPTIONS: C.EVENT.MULTIPLE_SUBSCRIPTIONS,
      SUBSCRIBE: C.ACTIONS.SUBSCRIBE,
      UNSUBSCRIBE: C.ACTIONS.UNSUBSCRIBE,
      NOT_SUBSCRIBED: C.EVENT.NOT_SUBSCRIBED
    }
    this._onBroadcastTimeout = this._onBroadcastTimeout.bind(this)
    this._onSocketClose = this._onSocketClose.bind(this)

    setInterval(this._onBroadcastTimeout, options.broadcastTimeout || 0)
  }

  getNames () {
    return this._subscriptions.keys()
  }

  hasName (subscriptionName) {
    return this._subscriptions.has(subscriptionName)
  }

  getSubscribers (name) {
    return this._subscriptions.get(name) || new Set()
  }

  setAction (name, value) {
    this._constants[name.toUpperCase()] = value
  }

  setSubscriptionListener (subscriptionListener) {
    this._subscriptionListener = subscriptionListener
  }

  subscribe (name, socket) {
    let sockets = this._subscriptions.get(name) || new Set()

    if (sockets.size === 0) {
      this._subscriptions.set(name, sockets)
    } else if (sockets.has(socket)) {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        this._constants.MULTIPLE_SUBSCRIPTIONS,
        `repeat supscription to "${name}" by ${socket.user}`
      )
      socket.sendError(this._topic, this._constants.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    sockets.add(socket)

    if (!socket.listeners('close').includes(this._onSocketClose)) {
      socket.once('close', this._onSocketClose)
    }

    const names = this._names.get(socket) || new Set()
    if (names.size === 0) {
      this._names.set(socket, names)
    }
    names.add(name)

    if (this._subscriptionListener) {
      this._subscriptionListener.onSubscriptionAdded(
        name,
        socket,
        sockets.size
      )
    }

    this._options.logger.log(
      C.LOG_LEVEL.DEBUG,
      this._constants.SUBSCRIBE,
      `for ${this._topic}:${name} by ${socket.user}`
    )
  }

  unsubscribe (name, socket, silent) {
    const sockets = this._subscriptions.get(name)

    if (!sockets || !sockets.delete(socket)) {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        this._constants.NOT_SUBSCRIBED,
        `${socket.user} is not subscribed to ${name}`
      )
      socket.sendError(this._topic, this._constants.NOT_SUBSCRIBED, name)
      return
    }

    if (sockets.size === 0) {
      this._subscriptions.delete(name)
      this._delayedBroadcasts.delete(name)
    } else {
      const delayedBroadcasts = this._delayedBroadcasts.get(name)
      if (delayedBroadcasts) {
        delayedBroadcasts.uniqueSenders.delete(socket)
      }
    }

    const names = this._names.get(socket)
    names.delete(name)

    if (names.size === 0) {
      this._names.delete(socket)
      socket.removeListener('close', this._onSocketClose)
    }

    if (this._subscriptionListener) {
      this._subscriptionListener.onSubscriptionRemoved(
        name,
        socket,
        sockets.size
      )
    }

    if (!silent) {
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        this._constants.UNSUBSCRIBE,
        `for ${this._topic}:${name} by ${socket.user}`
      )
    }
  }

  sendToSubscribers (name, msg, socket) {
    if (!msg) {
      return
    }

    const sockets = this._subscriptions.get(name)

    if (!sockets) {
      return
    }

    // not all messages are valid, this should be fixed elsewhere!
    if (msg.charAt(msg.length - 1) !== C.MESSAGE_SEPERATOR) {
      msg += C.MESSAGE_SEPERATOR
    }

    // if not already a delayed broadcast, create it
    const delayedBroadcasts = this._delayedBroadcasts.get(name) || {
      uniqueSenders: new Map(),
      sharedMessages: '',
      sockets
    }

    if (delayedBroadcasts.sharedMessages.length === 0) {
      this._delayedBroadcasts.set(name, delayedBroadcasts)
    }

    // append this message to the sharedMessage, the message that
    // is shared in the broadcast to every listener-only
    const start = delayedBroadcasts.sharedMessages.length
    delayedBroadcasts.sharedMessages += msg
    const stop = delayedBroadcasts.sharedMessages.length

    if (!socket) {
      return
    }

    const gaps = delayedBroadcasts.uniqueSenders.get(socket) || []

    if (gaps.length === 0) {
      delayedBroadcasts.uniqueSenders.set(socket, gaps)
    }

    gaps.push(start, stop)
  }

  _onSocketClose (socket) {
    for (const name of this._names.get(socket)) {
      this.unsubscribe(name, socket, true)
    }
  }

  _onBroadcastTimeout () {
    for (const { uniqueSenders, sharedMessages, sockets } of this._delayedBroadcasts.values()) {
      for (const [ socket, gaps ] of uniqueSenders) {
        let i = 0
        let message = sharedMessages.substring(0, gaps[i++])
        let lastStop = gaps[i++]

        while (i < gaps.length) {
          message += sharedMessages.substring(lastStop, gaps[i++])
          lastStop = gaps[i++]
        }
        message += sharedMessages.substring(lastStop, sharedMessages.length)

        socket.sendNative(message)
      }

      const preparedMessage = SocketWrapper.prepareMessage(sharedMessages)
      for (const socket of sockets) {
        if (!uniqueSenders.has(socket)) {
          socket.sendPrepared(preparedMessage)
        }
      }
      SocketWrapper.finalizeMessage(preparedMessage)
    }
    this._delayedBroadcasts.clear()
  }
}

module.exports = SubscriptionRegistry
