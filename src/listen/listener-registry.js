const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class ListenerRegistry {
  constructor (topic, options, subscriptionRegistry) {
    this._topic = topic
    this._listenResponseTimeout = options.listenResponseTimeout
    this._subscriptionRegistry = subscriptionRegistry

    this._listeners = new Map()
    this._providerRegistry = new SubscriptionRegistry(options, topic)
    this._providerRegistry.setSubscriptionListener({
      onSubscriptionAdded: this.onListenAdded.bind(this),
      onSubscriptionRemoved: this.onListenRemoved.bind(this)
    })

    this._matcher = options.patternMatcher
    this._matcher.onMatchAdded = this._onMatchAdded.bind(this)
    this._matcher.onMatchRemoved = this._onMatchRemoved.bind(this)
  }

  handle (socket, message) {
    if (!message.data || !message.data[0]) {
      socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ])
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
      socket.sendError(this._topic, C.EVENT.UNKNOWN_ACTION, [
        ...message.data,
        `unknown action ${message.action}`
      ])
    }
  }

  onListenAdded (pattern, socket, count, listener) {
    if (count === 1) {
      this._matcher.addPattern(pattern)
    }

    this._listeners.set(`${pattern}_${socket.id}`, new Set())
  }

  onListenRemoved (pattern, socket, count, listener) {
    if (count === 0) {
      this._matcher.removePattern(pattern)
    }

    for (const subscription of this._listeners.get(`${pattern}_${socket.id}`)) {
      this._provide(subscription)
    }

    this._listeners.delete(`${pattern}_${socket.id}`)
  }

  onNoProvider (subscription) {

  }

  onSubscriptionAdded (name, socket, count, subscription) {
    if (count === 1) {
      this._matcher.addName(name)
    } else if (subscription.socket) {
      this._sendHasProviderUpdate(subscription, socket)
    }
  }

  onSubscriptionRemoved (name, socket, count, subscription) {
    if (count === 0) {
      this._matcher.removeName(name)

      if (subscription.socket) {
        subscription.socket.sendMessage(
          this._topic,
          C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
          [ subscription.pattern, name ]
        )
      }

      this._reset(subscription)
    }
  }

  _accept (socket, [ pattern, name ]) {
    const subscription = this._subscriptionRegistry.getSubscription(name)
    const listener = this._listeners.get(`${pattern}_${socket.id}`)

    if (!subscription || subscription.socket || !listener) {
      socket.sendMessage(this._topic, C.ACTIONS.LISTEN_REJECT, [ pattern, name ])
    } else {
      listener.add(subscription)
      subscription.socket = socket
      subscription.pattern = pattern

      this._sendHasProviderUpdate(subscription)

      socket.sendMessage(this._topic, C.ACTIONS.LISTEN_ACCEPT, [ pattern, name ])
    }
  }

  _reject (socket, [ pattern, name ]) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription || subscription.socket !== socket || subscription.pattern !== pattern) {
      return
    }

    this._provide(subscription)
  }

  _onMatchAdded (name, matches) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription) {
      return
    }

    subscription.matches = (subscription.matches || []).concat(matches)

    if (subscription.socket) {
      return
    }

    if (matches.length > 0) {
      this._provide(subscription, matches)
    } else {
      this.onNoProvider(subscription)
    }
  }

  _onMatchRemoved (name, matches) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription) {
      return
    }

    for (const pattern of matches) {
      const idx = subscription.matches.indexOf(pattern)
      if (idx !== -1) {
        subscription.matches[idx] = subscription.matches.pop()
      }
    }
  }

  _reset (subscription) {
    if (subscription.socket) {
      const listener = this._listeners.get(`${subscription.pattern}_${subscription.socket.id}`)
      if (listener) {
        listener.delete(subscription)
      }
      subscription.socket = null
      subscription.pattern = null
    }
  }

  _provide (subscription, matches = subscription.matches) {
    if (subscription.socket) {
      this._reset(subscription)
      this._sendHasProviderUpdate(subscription)
    }

    for (const pattern of matches) {
      const message = messageBuilder.buildMsg4(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
        pattern,
        subscription.name
      )
      this._providerRegistry.sendToSubscribers(pattern, message)
    }
  }

  _sendHasProviderUpdate (subscription, socket) {
    const message = messageBuilder.buildMsg4(
      this._topic,
      C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
      subscription.name,
      subscription.socket ? C.TYPES.TRUE : C.TYPES.FALSE
    )

    if (socket) {
      socket.sendNative(message)
    } else {
      this._subscriptionRegistry.sendToSubscribers(subscription, message)
    }
  }
}
