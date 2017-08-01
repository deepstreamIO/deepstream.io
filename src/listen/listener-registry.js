'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class ListenerRegistry {
  constructor (topic, options, subscriptionRegistry) {
    this._listeners = new Map()
    this._topic = topic
    this._listenResponseTimeout = options.listenResponseTimeout
    this._subscriptionRegistry = subscriptionRegistry
    this._logger = options.logger

    this._providers = new Map()
    this._providerRegistry = new SubscriptionRegistry(options, topic)
    this._providerRegistry.setAction('subscribe', C.ACTIONS.LISTEN)
    this._providerRegistry.setAction('unsubscribe', C.ACTIONS.UNLISTEN)
    this._providerRegistry.setSubscriptionListener({
      onSubscriptionAdded: this.onListenAdded.bind(this),
      onSubscriptionRemoved: this.onListenRemoved.bind(this)
    })
  }

  handle (socket, message) {
    if (message.action === C.ACTIONS.LISTEN) {
      this._providerRegistry.subscribe(message.data[0], socket)
    } else if (message.action === C.ACTIONS.UNLISTEN) {
      this._providerRegistry.unsubscribe(message.data[0], socket)
    } else if (message.action === C.ACTIONS.LISTEN_ACCEPT) {
      this._accept(socket, message.data)
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      this._reject(socket, message.data)
    } else {
      socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
    }
  }

  onListenAdded (pattern, socket) {
    const listener = this._listeners.get(pattern) || {
      expr: null,
      sockets: new Map()
    }

    if (!listener.expr) {
      try {
        listener.expr = new RegExp(pattern)
      } catch (err) {
        socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, err.message)
        return
      }
      this._listeners.set(pattern, listener)
    }

    listener.sockets.set(socket, {
      socket,
      pattern,
      id: Math.random()
    })

    for (const name of this._subscriptionRegistry.getNames()) {
      if (this._providers.has(name) || !listener.expr.test(name)) {
        continue
      }
      this._provide(name, null)
    }
  }

  onListenRemoved (pattern, socket) {
    const listener = this._listeners.get(pattern)

    listener.sockets.delete(socket)

    if (listener.sockets.size === 0) {
      this._listeners.delete(pattern)
    }

    for (const [ name, provider ] of this._providers) {
      if (provider.pattern !== pattern || provider.socket !== socket) {
        continue
      }

      this._sendHasProviderUpdate(false, name)

      this._provide(name, provider)
    }
  }

  onSubscriptionAdded (name, socket, count) {
    if (count === 1) {
      this._provide(name, null)
    } else {
      const provider = this._providers.get(name)

      if (provider && provider.socket && !provider.timeout) {
        this._sendHasProviderUpdate(true, name, socket)
      }
    }
  }

  onSubscriptionRemoved (name, socket, count) {
    if (count !== 0) {
      return
    }

    const provider = this._providers.get(name)

    if (!provider) {
      return
    }

    if (provider.socket) {
      provider.socket.sendMessage(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        [ provider.pattern, name ]
      )
    }

    this._reset(provider)
    this._providers.delete(name)
  }

  _accept (socket, [ pattern, name ]) {
    const provider = this._providers.get(name)

    if (!provider) {
      return
    }

    if (!provider.timeout) {
      socket.sendMessage(this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ pattern, name ])
      return
    }

    this._reset(provider, socket, pattern)

    this._sendHasProviderUpdate(true, name, undefined)
  }

  _reject (socket, [ pattern, name ]) {
    const provider = this._providers.get(name)

    if (!provider || !provider.timeout) {
      return
    }

    if (provider.socket !== socket || provider.pattern !== pattern) {
      return
    }

    this._provide(name, provider)
  }

  _provide (name, provider) {
    if (provider) {
      this._reset(provider)
    }

    const match = this._match(name, provider && provider.history)

    if (!match) {
      return
    }

    if (!provider) {
      provider = this._reset()
      this._providers.set(name, provider)
    }

    provider.history.push(match.id)
    provider.socket = match.socket
    provider.pattern = match.pattern
    provider.timeout = setTimeout(() => this._provide(name, provider), this._listenResponseTimeout)

    provider.socket.sendMessage(
      this._topic,
      C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
      [ provider.pattern, name ]
    )
  }

  _reset (provider = Object.create(null), socket = null, pattern = null) {
    clearTimeout(provider.timeout)
    provider.history = provider.history || []
    provider.socket = socket
    provider.pattern = pattern
    provider.timeout = null
    return provider
  }

  _match (name, history) {
    // TODO: Optimize
    let results = []

    for (const [ , { expr, sockets } ] of this._listeners) {
      if (!expr.test(name)) {
        continue
      }

      for (const socket of sockets.values()) {
        if (history && history.includes(socket.id)) {
          continue
        }

        results.push(socket)
      }
    }

    return results[Math.floor(Math.random() * results.length)]
  }

  _sendHasProviderUpdate (hasProvider, name, socket) {
    if (this._topic !== C.TOPIC.RECORD) {
      return
    }

    const message = messageBuilder.getMsg(
      C.TOPIC.RECORD,
      C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
      [ name, hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE ]
    )

    if (socket) {
      socket.sendNative(message)
    } else {
      this._subscriptionRegistry.sendToSubscribers(name, message)
    }
  }
}
