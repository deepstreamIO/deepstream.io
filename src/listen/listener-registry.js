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
    } else {
      socket.sendError(this._topic, C.EVENT.UNKNOWN_ACTION, [
        ...message.data,
        `unknown action ${message.action}`
      ])
    }
  }

  onListenAdded (pattern, socket, count) {
    if (count === 1) {
      this._matcher.addPattern(pattern)
    }

    this._addListener(pattern, socket)
  }

  onListenRemoved (pattern, socket, count) {
    if (count === 0) {
      this._matcher.removePattern(pattern)
    }

    for (const subscription of this._getListener(pattern, socket)) {
      subscription.socket = null
      subscription.pattern = null
      this._sendHasProviderUpdate(subscription)
      this._matcher.getName(subscription.name)
    }

    this._removeListener(pattern, socket)
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

        const listener = this._getListener(subscription.pattern, subscription.socket)
        if (listener) {
          listener.delete(subscription)
        }
      }

      subscription.socket = null
      subscription.pattern = null
    }
  }

  _accept (socket, [ pattern, name ]) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription || subscription.socket) {
      return
    }

    const listener = this._getListener(pattern, socket)

    if (!listener) {
      return
    }

    listener.add(subscription)
    subscription.socket = socket
    subscription.pattern = pattern

    this._sendHasProviderUpdate(subscription)

    const message = messageBuilder.buildMsg4(
      this._topic,
      C.ACTIONS.LISTEN_ACCEPT,
      pattern,
      subscription.name
    )
    socket.sendNative(message)
  }

  _onMatch (name, matches) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription || subscription.socket) {
      return
    }

    if (matches.length === 0) {
      this.onNoProvider(subscription)
    } else {
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

  _addListener (pattern, socket) {
    this._listeners.set(`${pattern}/${socket.id}`, new Set())
  }

  _getListener (pattern, socket) {
    return this._listeners.get(`${pattern}/${socket.id}`)
  }

  _removeListener (pattern, socket) {
    this._listeners.delete(`${pattern}/${socket.id}`)
  }
}
