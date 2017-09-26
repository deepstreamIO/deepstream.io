const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')
const toFastProperties = require('to-fast-properties')
const assert = require('assert')

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
    this._matcher.onMatch = this._onMatch.bind(this)
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

  onListenAdded (pattern, socket, count) {
    const key = `${pattern}/${socket.id}`

    this._matcher.addPattern(pattern, socket.id)

    const listener = toFastProperties({
      key,
      pattern,
      socket,
      subscriptions: new Set()
    })

    this._listeners.set(key, listener)
  }

  onListenRemoved (pattern, socket, count) {
    const key = `${pattern}/${socket.id}`

    if (count === 0) {
      this._matcher.removePattern(pattern)
    }

    const listener = this._listeners.get(key)
    this._listeners.delete(key)

    for (const subscription of listener.subscriptions) {
      this._resetAccept(subscription)
    }
  }

  onUpdate (subscription) {
    if (!subscription.hasProvider && subscription.listener) {
      subscription.hasProvider = true
      this._sendHasProviderUpdate(subscription)
    }
  }

  onSubscriptionAdded (name, socket, count, subscription) {
    if (count === 1) {
      this._matcher.addName(name)
    } else if (subscription.listener) {
      this._sendHasProviderUpdate(subscription, socket)
    }
  }

  onSubscriptionRemoved (name, socket, count, subscription) {
    if (count === 0) {
      this._matcher.removeName(name)

      const { listener } = subscription

      if (listener) {
        assert(listener.socket)
        listener.socket.sendMessage(
          this._topic,
          C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
          [ listener.pattern, name ]
        )
        listener.subscriptions.delete(subscription)
      }

      subscription.accepts.clear()
      subscription.listener = null
      subscription.hasProvider = false
    }
  }

  _accept (socket, [ pattern, name ]) {
    const subscription = this._subscriptionRegistry.getSubscription(name)
    if (!subscription) {
      return
    }

    // TODO: Optimize
    for (const key of subscription.accepts.keys()) {
      if (!this._listeners.has(key)) {
        subscription.accepts.delete(key)
      }
    }

    const key = `${pattern}/${socket.id}`

    const listener = this._listeners.get(key)
    if (!listener) {
      return
    }

    subscription.accepts.add(key)

    this._sendAccept(listener, subscription)
  }

  _reject (socket, [ pattern, name ]) {
    const subscription = this._subscriptionRegistry.getSubscription(name)
    if (!subscription) {
      return
    }

    const key = `${pattern}/${socket.id}`
    subscription.accepts.delete(key)

    const listener = this._listeners.get(key)
    if (!listener) {
      return
    }

    listener.subscriptions.delete(subscription)

    if (subscription.listener === listener) {
      this._resetAccept(subscription)
    }
  }

  _resetAccept (subscription) {
    subscription.listener = null
    subscription.hasProvider = false
    this._sendHasProviderUpdate(subscription)

    const listeners = []
    // TODO: Optimize
    for (const key of subscription.accepts.keys()) {
      const listener = this._listeners.get(key)
      if (!listener) {
        subscription.accepts.delete(key)
      } else {
        listeners.push(listener)
      }
    }

    const listener = listeners[Math.floor(Math.random() * listeners.length)]

    if (listener) {
      this._sendAccept(listener, subscription)
    }
  }

  _sendAccept (listener, subscription) {
    if (subscription.listener) {
      return
    }

    subscription.listener = listener
    listener.subscriptions.add(subscription)

    const message = messageBuilder.buildMsg4(
      this._topic,
      C.ACTIONS.LISTEN_ACCEPT,
      listener.pattern,
      subscription.name
    )

    listener.socket.sendNative(message)
  }

  _onMatch (name, matches, id) {
    const subscription = this._subscriptionRegistry.getSubscription(name)
    if (!subscription || subscription.listener) {
      return
    }

    for (const pattern of matches) {
      const message = messageBuilder.buildMsg4(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
        pattern,
        subscription.name
      )
      if (id) {
        const listener = this._listeners.get(`${pattern}/${id}`)
        if (listener) {
          listener.socket.sendNative(message)
        }
      } else {
        this._providerRegistry.sendToSubscribers(pattern, message)
      }
    }
  }

  _sendHasProviderUpdate (subscription, socket) {
    const message = messageBuilder.buildMsg4(
      this._topic,
      C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
      subscription.name,
      subscription.hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE
    )
    if (socket) {
      socket.sendNative(message)
    } else {
      this._subscriptionRegistry.sendToSubscribers(subscription, message)
    }
  }
}
