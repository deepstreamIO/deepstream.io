const toFastProperties = require('to-fast-properties')
const C = require('../constants/constants')
const SocketWrapper = require('../message/socket-wrapper')
const invariant = require('invariant')

const EMPTY_SET = new Set()

let counter = 0

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
    this._pool = []
    this._subscriptionListener = {
      onSubscriptionAdded () {

      },
      onSubscriptionRemoved () {

      }
    }
  }

  _alloc (name) {
    const subscription = this._pool.pop()
    if (subscription) {
      subscription.name = name
      return subscription
    } else {
      return toFastProperties({
        owner: this,
        name,
        shared: '',
        senders: new Map(),
        sockets: new Set()
      })
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

  getSubscribers (name) {
    const subscription = this._subscriptions.get(name)
    return subscription ? subscription.sockets : EMPTY_SET
  }

  subscribe (name, socket, subscription) {
    subscription = subscription || this._subscriptions.get(name) || this._alloc(name)

    if (subscription.sockets.has(socket)) {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        C.EVENT.MULTIPLE_SUBSCRIPTIONS,
        `repeat supscription to ${this._topic}/${name}/ by ${socket.user}/${socket.id}`
      )
      socket.sendError(this._topic, C.EVENT.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    invariant(name === subscription.name, `invalid subscription name ${subscription.name} for ${this._topic}/${name}`)

    // this._options.logger.log(
    //   C.LOG_LEVEL.DEBUG,
    //   C.EVENT.SUBSCRIBE,
    //   `for ${this._topic}/${name} by ${socket.user}/${socket.id}`
    // )

    this._addSocket(subscription, socket)
  }

  unsubscribe (name, socket) {
    const subscription = this._subscriptions.get(name)

    if (!subscription || !subscription.sockets.has(socket)) {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        C.EVENT.NOT_SUBSCRIBED,
        `${socket.user}/${socket.id} is not subscribed to ${this._topic}/${name}`
      )
      socket.sendError(this._topic, C.EVENT.NOT_SUBSCRIBED, name)
      return
    }

    invariant(name === subscription.name, `invalid subscription name ${subscription.name} for ${this._topic}/${name}`)

    // this._options.logger.log(
    //   C.LOG_LEVEL.DEBUG,
    //   C.EVENT.UNSUBSCRIBE,
    //   `for ${this._topic}/${name} by ${socket.user}/${socket.id}`
    // )

    this._removeSocket(subscription, socket)
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
      this._removeSocket(subscription, socket)
    }
  }

  _addSocket (subscription, socket) {
    invariant(!subscription.sockets.has(socket), `existing socket of ${socket.user}/${socket.id}`)
    subscription.sockets.add(socket)

    if (subscription.sockets.size === 1) {
      invariant(!this._subscriptions.has(subscription.name), `existing subscription of ${this._topic}/${subscription.name}`)
      this._subscriptions.set(subscription.name, subscription)
    }

    const subscriptions = this._sockets.get(socket) || new Set()
    invariant(!subscriptions.has(subscription), `existing subscription for ${this._topic}/${subscription.name}`)
    subscriptions.add(subscription)

    if (subscriptions.size === 1) {
      this._sockets.set(socket, subscriptions)
      socket.once('close', this._onSocketClose)
    }

    this._subscriptionListener.onSubscriptionAdded(
      subscription.name,
      socket,
      subscription.sockets.size,
      subscription
    )
  }

  _removeSocket (subscription, socket) {
    invariant(subscription.sockets.has(socket), `missing socket of ${socket.user}/${socket.id}`)
    subscription.sockets.delete(socket)

    if (subscription.sockets.size === 0) {
      invariant(this._subscriptions.has(subscription.name), `missing subscription for ${this._topic}/${subscription.name}`)
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
    invariant(subscriptions.has(subscription), `missing subscription for ${socket.user}/${socket.id}`)
    subscriptions.delete(subscription)

    if (subscriptions.size === 0) {
      this._sockets.delete(socket)
      socket.removeListener('close', this._onSocketClose)
    }

    this._subscriptionListener.onSubscriptionRemoved(
      subscription.name,
      socket,
      subscription.sockets.size,
      subscription
    )

    if (subscription.sockets.size === 0 && subscription.owner === this) {
      invariant(!this._pool.includes(subscription), `pool contains subscription ${this._topic}/${subscription.name}`)
      subscription.name = null
      this._pool.push(subscription)
    }
  }

  _dispatch () {
    this._broadcastTimeout = null

    for (const subscription of this._pending) {
      const { senders, shared, sockets } = subscription

      counter = (counter + 1) % Number.MAX_SAFE_INTEGER

      for (const [ socket, gaps ] of senders) {
        let i = 0
        let message = shared.substring(0, gaps[i++])
        let lastStop = gaps[i++]

        while (i < gaps.length) {
          message += shared.substring(lastStop, gaps[i++])
          lastStop = gaps[i++]
        }
        message += shared.substring(lastStop, shared.length)

        socket.opaque = counter

        if (message) {
          socket.sendNative(message)
        }
      }

      const preparedMessage = SocketWrapper.prepareMessage(shared)
      for (const socket of sockets) {
        if (socket.opaque !== counter) {
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
