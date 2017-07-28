'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class ListenerRegistry {
  constructor (topic, options, subscriptionRegistry) {
    this._listeners = new Map()
    this._timeouts = new Map()
    this._provided = new Set()
    this._pending = new Set()

    this._timeout = null
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
      pattern
    })

    this._reconcilePattern(listener.expr)
  }

  onListenRemoved (pattern, socket) {
    const listener = this._listeners.get(pattern)

    listener.sockets.delete(socket)

    if (listener.sockets.size === 0) {
      this._listeners.delete(pattern)
    }

    this._reconcilePattern(listener.expr)
  }

  onSubscriptionAdded (name, socket, localCount) {
    if (localCount === 1) {
      this._reconcile(name)
    }

    if (this._provided.has(name)) {
      this._sendHasProviderUpdate(true, name, socket)
    }
  }

  onSubscriptionRemoved (name, socket, localCount) {
    if (localCount === 0) {
      this._reconcile(name)
    }
  }

  _accept (socket, [ pattern, name ]) {
    clearTimeout(this._timeouts.get(name))
    this._timeouts.delete(name)

    const prev = this._providers.get(name) || {}

    if (!prev.deadline) {
      socket.sendMessage(this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ pattern, name ])
      return
    }

    this._providers.set(name, {
      socket,
      history: prev.history,
      pattern: pattern,
      deadline: null
    })

    this._reconcile(name)
  }

  _reject (socket, [ pattern, name ]) {
    clearTimeout(this._timeouts.get(name))
    this._timeouts.delete(name)

    const prev = this._providers.get(name) || {}

    if (prev.socket !== socket || prev.pattern !== pattern) {
      return
    }

    this._providers.set(name, {
      history: prev.history
    })

    this._reconcile(name)
  }

  _reconcilePattern (expr) {
    // TODO: Optimize
    for (const name of this._subscriptionRegistry.getNames()) {
      if (!expr || expr.test(name)) {
        this._reconcile(name)
      }
    }
  }

  _reconcile (name) {
    const prev = this._providers.get(name) || {}

    if (!prev.deadline && this._isAlive(prev)) {
      if (!this._provided.has(name)) {
        this._sendHasProviderUpdate(true, name)
        this._provided.add(name)
      }
    } else if (this._provided.delete(name)) {
      this._sendHasProviderUpdate(false, name)
    }

    let next = {}

    if (this._subscriptionRegistry.hasName(name)) {
      if (this._isAlive(prev)) {
        return
      }

      const history = prev.history || []
      const matches = this._match(name).filter(match => !history.includes(match.id))

      if (matches.length === 0) {
        next = history.length ? { history } : {}
      } else {
        const match = matches[Math.floor(Math.random() * matches.length)]

        next = {
          history: history.concat(match.id),
          socket: match.socket,
          pattern: match.pattern,
          deadline: Date.now() + this._listenResponseTimeout
        }
      }
    }

    this._providers.set(name, next)

    if (next.socket) {
      this._timeouts.set(name, setTimeout(() => this._reconcile(name), this._listenResponseTimeout))

      next.socket.sendMessage(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
        [ next.pattern, name ]
      )
    } else if (prev.socket) {
      prev.socket.sendMessage(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        [ prev.pattern, name ]
      )
    }
  }

  _match (name) {
    // TODO: Optimize
    const matches = []
    for (const { expr, sockets } of this._listeners.values()) {
      if (expr.test(name)) {
        matches.push(...sockets.values())
      }
    }
    return matches
  }

  _isAlive (provider) {
    return (
      provider &&
      (!provider.deadline || provider.deadline > Date.now()) &&
      provider.socket &&
      !provider.socket.isClosed
    )
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
      socket.send(message)
    } else {
      this._subscriptionRegistry.sendToSubscribers(name, message)
    }
  }
}
