const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class ListenerRegistry {
  constructor (topic, options, subscriptionRegistry) {
    this._topic = topic
    this._listenResponseTimeout = options.listenResponseTimeout
    this._subscriptionRegistry = subscriptionRegistry

    this._providerRegistry = new SubscriptionRegistry(options, topic)
    this._providerRegistry.onSubscriptionAdded = this.onListenAdded.bind(this)
    this._providerRegistry.onSubscriptionRemoved = this.onListenRemoved.bind(this)

    this._subscriptionRegistry.onSubscriptionAdded = this.onSubscriptionAdded.bind(this)
    this._subscriptionRegistry.onSubscriptionRemoved = this.onSubscriptionRemoved.bind(this)

    this._onMatch = this._onMatch.bind(this)
  }

  handle (socket, message) {
    if (!message.data || !message.data[0]) {
      socket.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ])
      return
    }

    if (message.action === C.ACTIONS.LISTEN) {
      this._providerRegistry.subscribe(message.data[0], socket)
    } else if (message.action === C.ACTIONS.UNLISTEN) {
      this._providerRegistry.unsubscribe(message.data[0], socket)
    } else if (message.action === C.ACTIONS.LISTEN_ACCEPT) {
      this._accept(socket, message.data)
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      this._reject(socket, message.data)
    } else {
      socket.sendError(C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, [
        ...message.data,
        `unknown action ${message.action}`
      ])
    }
  }

  onListenAdded (pattern, socket, count, listener) {
    if (!listener.expr) {
      try {
        listener.expr = new RegExp(pattern)
      } catch (err) {
        socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, err.message)
        return
      }
    }

    // TODO: O(N^2) - Optimize
    for (const subscription of this._subscriptionRegistry.getSubscriptions()) {
      if (!subscription.socket && listener.expr.test(subscription.name)) {
        this._provide(subscription)
      }
    }
  }

  onListenRemoved (pattern, socket, count, listener) {
    // TODO: O(N^2) - Optimize
    for (const subscription of this._subscriptionRegistry.getSubscriptions()) {
      if (subscription.pattern === pattern && subscription.socket === socket) {
        this._provide(subscription)
      }
    }
  }

  onSubscriptionAdded (name, socket, count, subscription) {
    if (count === 1) {
      this._provide(subscription)
    } else if (subscription.active) {
      this._sendHasProviderUpdate(true, subscription, socket)
    }
  }

  onSubscriptionRemoved (name, socket, count, subscription) {
    if (count !== 0) {
      return
    }

    if (subscription.socket) {
      subscription.socket.sendMessage(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        [ subscription.pattern, name ]
      )
    }

    clearTimeout(subscription.timeout)
  }

  _accept (socket, [ pattern, name ]) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription || subscription.active) {
      socket.sendMessage(this._topic, C.ACTIONS.LISTEN_REJECT, [ pattern, name ])
      return
    }

    clearTimeout(subscription.timeout)

    subscription.timeout = null
    subscription.pattern = pattern
    subscription.socket = socket
    subscription.active = true

    this._sendHasProviderUpdate(true, subscription, undefined)

    socket.sendMessage(this._topic, C.ACTIONS.LISTEN_ACCEPT, [ pattern, name ])
  }

  _reject (socket, [ pattern, name ]) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription || !subscription.timeout) {
      return
    }

    if (subscription.socket !== socket || subscription.pattern !== pattern) {
      return
    }

    this._provide(subscription)
  }

  _provide (subscription) {
    if (subscription.timeout) {
      clearTimeout(subscription.timeout)
      subscription.timeout = null
    }

    if (subscription.active) {
      this._sendHasProviderUpdate(false, subscription)
      subscription.active = false
    }

    if (subscription.history) {
      subscription.socket = null
      subscription.pattern = null
    }

    this._match(subscription.name, this._onMatch)
  }

  _onMatch (err, name, patterns) {
    if (err) {
      return
    }

    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription || subscription.socket) {
      return
    }

    let matches = []

    for (const pattern of patterns) {
      const listener = this._providerRegistry.getSubscription(pattern)
      for (const socket of listener.sockets || new Set()) {
        const id = `${pattern}_${socket.id}`
        if (!subscription.history || !subscription.history.has(id)) {
          matches.push({ socket, pattern, id })
        }
      }
    }

    const match = matches[Math.floor(Math.random() * matches.length)]

    if (!match) {
      return
    }

    subscription.history = subscription.history || new Set()
    subscription.history.add(match.id)
    subscription.socket = match.socket
    subscription.pattern = match.pattern
    subscription.timeout = setTimeout(() => this._provide(subscription), this._listenResponseTimeout)

    subscription.socket.sendMessage(
      this._topic,
      C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
      [ subscription.pattern, subscription.name ]
    )
  }

  // TODO: O(N) - Optimize
  _match (name, callback) {
    let patterns = []

    for (const listener of this._providerRegistry.getSubscriptions()) {
      if (listener.expr && listener.expr.test(name)) {
        patterns.push(listener.name)
      }
    }

    callback(null, name, patterns)
  }

  _sendHasProviderUpdate (hasProvider, subscription, socket) {
    const message = messageBuilder.buildMsg4(
      this._topic,
      C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
      subscription.name,
      hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE
    )

    if (socket) {
      socket.sendNative(message)
    } else {
      this._subscriptionRegistry.sendToSubscribers(subscription, message)
    }
  }
}
