const C = require('../constants/constants')
const SocketWrapper = require('../message/socket-wrapper')
const invariant = require('invariant')

const EMPTY_SET = new Set()

let idCounter = 0

class SubscriptionRegistry {
  constructor (options, topic) {
    invariant(topic, 'missing subscription topic')

    this._sockets = new Map()
    this._broadcastTimeoutTime = options.broadcastTimeout || 0
    this._broadcastTimeout = null
    this._pending = []
    this._subscriptions = new Map()
    this._options = options
    this._topic = topic
    this._dispatch = this._dispatch.bind(this)
    this._onSocketClose = this._onSocketClose.bind(this)
    this._subscriptionListener = {
      onSubscriptionAdded () {

      },
      onSubscriptionRemoved () {

      }
    }
  }

  setSubscriptionListener (listener) {
    this._subscriptionListener = listener
  }

  getSubscriptions () {
    return this._subscriptions.values()
  }

  getSubscription (name) {
    return this._subscriptions.get(name)
  }

  getNames () {
    return this._subscriptions.keys()
  }

  hasName (name) {
    return this._subscriptions.has(name)
  }

  getSubscribers (name) {
    const subscription = this._subscriptions.get(name)
    return subscription ? subscription.sockets : EMPTY_SET
  }

  subscribe (name, socket) {
    const subscription = this._subscriptions.get(name) || {
      name,
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

    this._options.logger.log(
      C.LOG_LEVEL.DEBUG,
      C.EVENT.SUBSCRIBE,
      `for ${this._topic}:${name} by ${socket.user}`
    )

    return this._addSocket(subscription, socket)
  }

  unsubscribe (name, socket) {
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

    this._options.logger.log(
      C.LOG_LEVEL.DEBUG,
      C.EVENT.UNSUBSCRIBE,
      `for ${this._topic}:${name} by ${socket.user}`
    )

    return this._removeSocket(subscription, socket)
  }

  sendToSubscribers (nameOrSubscription, message, socket) {
    if (!message) {
      return
    }

    const subscription = typeof nameOrSubscription === 'string'
      ? this._subscriptions.get(nameOrSubscription)
      : nameOrSubscription

    if (!subscription) {
      return
    }

    // not all messages are valid, this should be fixed elsewhere!
    if (message.charAt(message.length - 1) !== C.MESSAGE_SEPERATOR) {
      message += C.MESSAGE_SEPERATOR
    }

    if (subscription.shared.length === 0) {
      this._pending.push(subscription)
    }

    // append this message to the sharedMessage, the message that
    // is shared in the broadcast to every listener-only
    const start = subscription.shared.length
    subscription.shared += message
    const stop = subscription.shared.length

    if (socket) {
      const gaps = subscription.senders.get(socket) || []

      if (gaps.length === 0) {
        subscription.senders.set(socket, gaps)
      }

      gaps.push(start, stop)
    }

    this.dispatch()
  }

  dispatch () {
    if (!this._broadcastTimeout) {
      this._broadcastTimeout = setTimeout(this._dispatch, this._broadcastTimeoutTime)
    }
  }

  _onSocketClose (socket) {
    for (const subscription of this._sockets.get(socket)) {
      subscription.sockets.delete(socket)
      this._removeSocket(subscription, socket)
    }
  }

  _addSocket (subscription, socket) {
    const subscriptions = this._sockets.get(socket) || new Set()

    if (subscriptions.size === 0) {
      this._sockets.set(socket, subscriptions)
      socket.once('close', this._onSocketClose)
    }

    invariant(!subscriptions.has(subscription), `existing subscription for ${subscription.name}`)
    subscriptions.add(subscription)

    this._subscriptionListener.onSubscriptionAdded(
      subscription.name,
      socket,
      subscription.sockets.size,
      subscription
    )
  }

  _removeSocket (subscription, socket) {
    if (subscription.sockets.size === 0) {
      invariant(this._subscriptions.has(subscription.name), `missing subscription for ${subscription.name}`)
      this._subscriptions.delete(subscription.name)

      subscription.shared = ''
      subscription.senders.clear()
      subscription.sockets.clear()

      const idx = this._pending.indexOf(subscription)
      if (idx !== -1) {
        this._pending.splice(idx, 1)
      }
    } else {
      subscription.senders.delete(socket)
    }

    const subscriptions = this._sockets.get(socket)

    invariant(subscriptions.has(subscription), `missing subscription for ${socket.user}`)
    subscriptions.delete(subscription)

    this._subscriptionListener.onSubscriptionRemoved(
      subscription.name,
      socket,
      subscription.sockets.size,
      subscription
    )
  }

  _dispatch () {
    this._broadcastTimeout = null

    for (const subscription of this._pending) {
      const { senders, shared, sockets } = subscription

      idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER

      for (const [ socket, gaps ] of senders) {
        let i = 0
        let message = shared.substring(0, gaps[i++])
        let lastStop = gaps[i++]

        while (i < gaps.length) {
          message += shared.substring(lastStop, gaps[i++])
          lastStop = gaps[i++]
        }
        message += shared.substring(lastStop, shared.length)

        socket.__id = idCounter

        if (message) {
          socket.sendNative(message)
        }
      }

      const preparedMessage = SocketWrapper.prepareMessage(shared)
      for (const socket of sockets) {
        if (socket.__id !== idCounter) {
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
