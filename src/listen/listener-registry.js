const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class ListenerRegistry {
  constructor (topic, options, subscriptionRegistry) {
    this._topic = topic
    this._listenResponseTimeout = options.listenResponseTimeout
    this._subscriptionRegistry = subscriptionRegistry
    this._logger = options.logger

    this._providers = new Map()
    this._providerRegistry = new SubscriptionRegistry(options, topic)
    this._providerRegistry.onSubscriptionAdded = this.onListenAdded.bind(this)
    this._providerRegistry.onSubscriptionRemoved = this.onListenRemoved.bind(this)

    this._subscriptionRegistry.onSubscriptionAdded = this.onSubscriptionAdded.bind(this)
    this._subscriptionRegistry.onSubscriptionRemoved = this.onSubscriptionRemoved.bind(this)
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

    for (const name of this._subscriptionRegistry.getNames()) {
      const provider = this._providers.get(name)

      if (provider && provider.socket) {
        continue
      }

      if (!listener.expr.test(name)) {
        continue
      }

      this._provide(name, provider)
    }
  }

  onListenRemoved (pattern, socket, count, listener) {
    if (!listener.expr) {
      return
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
      this._provide(name)
    } else {
      const provider = this._providers.get(name)

      if (provider && provider.active) {
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

  hasName (name) {
    return this._providers.has(name)
  }

  _accept (socket, [ pattern, name ]) {
    const provider = this._providers.get(name)

    if (!provider) {
      return
    }

    if (provider.active) {
      socket.sendMessage(this._topic, C.ACTIONS.LISTEN_REJECT, [ pattern, name ])
      return
    }

    this._reset(provider)

    provider.pattern = pattern
    provider.socket = socket
    provider.active = true

    this._sendHasProviderUpdate(true, name, undefined)

    socket.sendMessage(this._topic, C.ACTIONS.LISTEN_ACCEPT, [ pattern, name ])
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

  _reset (provider = Object.create(null)) {
    clearTimeout(provider.timeout)
    provider.history = provider.history || []
    provider.socket = null
    provider.pattern = null
    provider.timeout = null
    provider.active = false
    return provider
  }

  _match (name, history) {
    // TODO: Optimize
    let matches = []

    for (const [ pattern, { expr, sockets } ] of this._providerRegistry.getSubscriptions()) {
      if (!expr || !expr.test(name)) {
        continue
      }

      for (const socket of sockets) {
        const id = `${pattern}_${socket.id}`

        if (history && history.includes(id)) {
          continue
        }

        matches.push({ socket, pattern, id })
      }
    }

    return matches[Math.floor(Math.random() * matches.length)]
  }

  _sendHasProviderUpdate (hasProvider, name, socket) {
    const message = messageBuilder.buildMsg4(
      this._topic,
      C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
      name,
      hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE
    )

    if (socket) {
      socket.sendNative(message)
    } else {
      this._subscriptionRegistry.sendToSubscribers(name, message)
    }
  }
}
