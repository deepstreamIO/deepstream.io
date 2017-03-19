'use strict'

const C = require('../constants/constants')

const SEP = String.fromCharCode(30)
const SubscriptionRegistry = require('../utils/subscription-registry')

module.exports = class ListenerRegistry {
  constructor (topic, options, subscriptionRegistry) {
    this._reconcile = this._reconcile.bind(this)

    this._listeners = new Map()
    this._timeouts = new Map()

    this._topic = topic
    this._listenResponseTimeout = options.listenResponseTimeout
    this._serverName = options.serverName
    this._subscriptionRegistry = subscriptionRegistry
    this._logger = options.logger

    this._providers = options.stateConnector.get('providers')
    this._providers.watch(this._reconcile)

    this._providerRegistry = new SubscriptionRegistry(options, topic, `${topic}_${C.TOPIC.LISTEN_PATTERNS}`)
    this._providerRegistry.setAction('subscribe', C.ACTIONS.LISTEN)
    this._providerRegistry.setAction('unsubscribe', C.ACTIONS.UNLISTEN)
    this._providerRegistry.setSubscriptionListener({
      onSubscriptionRemoved: this._onPatternRemoved.bind(this),
      onSubscriptionMade: this._onPatternAdded.bind(this)
    })
  }

  handle (socket, message) {
    if (message.action === C.ACTIONS.LISTEN) {
      this._listen(socket, message.data)
    } else if (message.action === C.ACTIONS.UNLISTEN) {
      this._unlisten(socket, message.data)
    } else if (message.action === C.ACTIONS.LISTEN_ACCEPT) {
      this._accept(socket, message.data)
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      this._reject(socket, message.data)
    } else {
      socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
    }
  }

  onSubscriptionMade (name) {
    this._tryAdd(name)
      .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
  }

  onSubscriptionRemoved (name) {
    this._tryRemove(name)
      .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
  }

  _listen (socket, [ pattern ]) {
    this._providerRegistry.subscribe(pattern, socket)
  }

  _unlisten (socket, [ pattern ]) {
    this._providerRegistry.unsubscribe(pattern, socket)
  }

  _onPatternAdded (pattern, socket) {
    if (socket) {
      const { patterns = new Set() } = this._listeners.get(socket.uuid) || {}

      if (patterns.has(pattern)) {
        socket.sendError(this._topic, C.EVENT.MULTIPLE_LISTENERS, [ pattern ])
        return
      }

      if (patterns.size === 0) {
        this._listeners.set(socket.uuid, { socket, patterns })
        socket.once('close', () => {
          this._listeners.delete(socket.uuid)
          this._reconcile()
        })
      }

      patterns.add(pattern)
    }

    this._reconcile()
  }

  _onPatternRemoved (pattern, socket) {
    if (socket) {
      const { patterns = new Set() } = this._listeners.get(socket.uuid) || {}

      if (!patterns.has(pattern)) {
        socket.sendError(this._topic, C.EVENT.NOT_LISTENING, [ pattern ])
        return
      }

      patterns.delete(pattern)

      if (patterns.size === 0) {
        this._listeners.delete(socket.uuid)
      }
    }

    this._reconcile()
  }

  _accept (socket, [ pattern, name ]) {
    clearTimeout(this._timeouts.get(name))
    this._timeouts.delete(name)

    this._providers
      .upsert(name, prev =>
        prev.serverName === this._serverName &&
        prev.socketId === socket.uuid &&
        prev.pattern === pattern &&
        Object.assign({}, prev, { deadline: null })
      )
      .then(([ next, prev ]) => {
        if (!next) {
          socket.sendMessage(this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ pattern, name ])
        }
      })
      .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
  }

  _reject (socket, [ pattern, name ]) {
    clearTimeout(this._timeouts.get(name))
    this._timeouts.delete(name)

    this._providers
      .upsert(name, prev =>
        prev.serverName === this._serverName &&
        prev.socketId === socket.uuid &&
        prev.pattern === pattern &&
        Object.assign({}, prev, { deadline: null, serverName: null })
      )
      .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
  }

  _reconcile (name = this._subscriptionRegistry.getNames()) {
    if (Array.isArray(name)) {
      return Promise.all(name.map(this._reconcile))
    }

    if (this._subscriptionRegistry.hasName(name)) {
      return this
        ._tryAdd(name)
        .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
    } else {
      return this
        ._tryRemove(name)
        .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
    }
  }

  _match (name) {
    const matches = []
    for (const { socket, patterns } of this._listeners.values()) {
      for (const pattern of patterns) {
        if (new RegExp(pattern).test(name)) {
          matches.push({
            id: this._serverName + SEP + socket.uuid + SEP + pattern,
            socket: socket,
            pattern
          })
        }
      }
    }
    return matches
  }

  _tryAdd (name) {
    if (this._match(name).length === 0) {
      return Promise.resolve()
    }

    return this._providers
      .upsert(name, prev => {
        if (this._isAlive(prev)) {
          return
        }

        const history = prev.history || []
        const matches = this._match(name).filter(match => !history.includes(match.id))

        if (matches.length === 0) {
          return { history }
        }

        const match = matches[Math.floor(Math.random() * matches.length)]

        return {
          history: history.concat(match.id),
          socketId: match.socket.uuid,
          pattern: match.pattern,
          serverName: this._serverName,
          deadline: Date.now() + this._listenResponseTimeout
        }
      })
      .then(([ next, prev ]) => {
        if (!next || !next.serverName) {
          return
        }

        const { socket } = this._listeners.get(next.socketId)

        if (!socket) {
          return this._reconcile(name)
        }

        socket.sendMessage(this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ next.pattern, name ])

        this._timeouts.set(name, setTimeout(() => this._reconcile(name), this._listenResponseTimeout))
      })
  }

  _tryRemove (name) {
    return this._providers
      .upsert(name, prev => prev.serverName && (this._isLocal(prev) || !this._isRemote(prev)) && {})
      .then(([ next, prev ]) => {
        if (!next) {
          return
        }

        const { socket } = this._listeners.get(prev.socketId) || {}

        if (!socket) {
          return
        }

        socket.sendMessage(this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ prev.pattern, name ])
      })
  }

  _isLocal (provider) {
    return provider.serverName === this._serverName
  }

  _isRemote (provider) {
    return this._subscriptionRegistry.getAllRemoteServers().indexOf(provider.serverName) !== -1
  }

  _isConnected (provider) {
    if (this._isLocal(provider)) {
      const { patterns = new Set() } = this._listeners.get(provider.socketId)
      return patterns.has(provider.pattern)
    } else {
      return this._isRemote(provider)
    }
  }

  _isAlive (provider) {
    return (!provider.deadline || provider.deadline > Date.now()) && this._isConnected(provider)
  }
}
