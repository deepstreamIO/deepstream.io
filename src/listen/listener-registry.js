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

    this._matcher = new Matcher()
    this._matcher.onMatch = this._onMatch.bind(this)
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
    if (count === 1) {
      try {
        listener.subscriptions = new Set()
        this._matcher.addPattern(pattern)
      } catch (err) {
        socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, err.message)
      }
    }
  }

  onListenRemoved (pattern, socket, count, listener) {
    if (count === 0) {
      this._matcher.removePattern(pattern)
    }

    for (const subscription of listener.subscriptions) {
      this._provide(subscription)
    }
  }

  onSubscriptionAdded (name, socket, count, subscription) {
    if (count === 1) {
      this._matcher.addName(name)
    } else if (subscription.active) {
      this._sendHasProviderUpdate(true, subscription, socket)
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

      clearTimeout(subscription.timeout)
    }
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

    if (subscription.listener) {
      subscription.listener.subscriptions.delete(subscription)
      subscription.listener = null
      subscription.history = null
      subscription.socket = null
      subscription.pattern = null
    }

    this._matcher.match(subscription.name)
  }

  _onMatch (name, patterns) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription || subscription.socket) {
      return
    }

    let matches = []

    for (const pattern of patterns) {
      const listener = this._providerRegistry.getSubscription(pattern)
      if (!listener) {
        continue
      }
      for (const socket of listener.sockets) {
        const id = `${pattern}_${socket.id}`
        if (!subscription.history || !subscription.history.has(id)) {
          matches.push({ socket, pattern, id, listener })
        }
      }
    }

    const match = matches[Math.floor(Math.random() * matches.length)]

    if (!match) {
      return
    }

    subscription.listener = match.listener
    subscription.listener.subscriptions.add(subscription)
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

class Matcher {
  constructor () {
    this._pending = []
    this._match = this._match.bind(this)
    this._patterns = new Map()
    this._names = new Set()
  }

  onMatch (name, pattern) {

  }

  addName (name) {
    this._names.add(name)
    this.match(name)
  }

  removeName (name) {
    this._names.delete(name)

    const index = this._pending.indexOf(name)

    if (index !== -1) {
      this._pending.splice(index, 1)
    }
  }

  addPattern (pattern) {
    const expr = new RegExp(pattern)
    this._patterns.set(pattern, expr)
    setImmediate(() => {
      for (const name of this._names) {
        if (expr.test(name)) {
          this.match(name)
        }
      }
    })
  }

  removePattern (pattern) {
    this._patterns.delete(pattern)
  }

  match (name) {
    if (!this._pending.includes(name)) {
      this._pending.push(name)
    }

    if (this._pending.length === 1) {
      setImmediate(this._match)
    }
  }

  _match () {
    const name = this._pending.shift()

    if (!name) {
      return
    }

    let patterns = []

    for (const [ pattern, expr ] of this._patterns) {
      if (expr && expr.test(name)) {
        patterns.push(pattern)
      }
    }

    this.onMatch(name, patterns)

    setImmediate(this._match)
  }
}
