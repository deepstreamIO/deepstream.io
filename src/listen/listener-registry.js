'use strict'

const C = require('../constants/constants')

const SEP = String.fromCharCode(30)

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

    this._providers = options.stateRegistry.get('providers')
    this._providers.watch(this._reconcile)

    this._clusterRegistry = options.clusterRegistry
    this._clusterRegistry.on('add', () => this._reconcile(this._subscriptionRegistry.getNames()))
    this._clusterRegistry.on('remove', () => this._reconcile(this._providers.keys()))
  }

  handle (socket, message) {
    if (message.action === C.ACTIONS.LISTEN) {
      this._listen(socket, message)
    } else if (message.action === C.ACTIONS.UNLISTEN) {
      this._unlisten(socket, message)
    } else if (message.action === C.ACTIONS.LISTEN_ACCEPT) {
      this._accept(socket, message)
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      this._reject(socket, message)
    } else {
      socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
    }
  }

  onSubscriptionMade (name) {
    this._reconcile(name)
  }

  onSubscriptionRemoved (name) {
    this._reconcile(name)
  }

  _listen (socket, [ pattern ]) {
    const { patterns = new Set() } = this._listeners.get(socket.uuid) || {}

    if (patterns.size === 0) {
      this._listeners.set(socket.uuid, { socket, patterns })
      socket.once('close', () => {
        this._listeners.delete(socket.uuid)
        this._reconcile(this._subscriptionRegistry.getNames())
      })
    }

    if (patterns.has(pattern)) {
      socket.sendError(this._topic, C.EVENT.MULTIPLE_LISTENERS, [ pattern ])
    }

    patterns.add(pattern)

    this._reconcile(this._subscriptionRegistry.getNames())
  }

  _unlisten (socket, [ pattern ]) {
    const { patterns = new Set() } = this._listeners.get(socket.uuid) || {}

    if (!patterns.has(pattern)) {
      socket.sendError(this._topic, C.EVENT.NOT_LISTENING, [ pattern ])
    }

    patterns.delete(pattern)

    if (patterns.size === 0) {
      this._listeners.delete(socket.uuid)
    }

    this._reconcile(this._subscriptionRegistry.getNames())
  }

  _accept (socket, [ pattern, name ]) {
    clearTimeout(this._timeouts.get(name))
    this._timeouts.delete(name)

    this._providers
      .upsert(name, prev =>
        prev.serverName === this._serverName &&
        prev.socketId === socket.uuid &&
        prev.pattern === pattern &&
        { ...prev, deadline: null }
      )
      .then(([ next, prev ]) => {
        if (!next) {
          socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ pattern, name ])
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
        { ...prev, deadline: null, serverName: null }
      )
      .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
  }

  _reconcile (name) {
    if (name.then) {
      return name
        .then(this._reconcile)
        .catch(err => this._logger.log(C.LOG_LEVEL.ERROR, err.message))
    }

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

  _tryAdd (name) {
    return this._providers
      .upsert(name, prev => {
        if (this._isAlive(prev)) {
          return
        }

        const history = prev.history || []
        const matches = this._listeners
          .entries()
          .reduce((matches, [ socketId, { patterns } ]) => matches.concat(patterns
            .filter(pattern =>
              history.indexOf(this._serverName + SEP + socketId + SEP + pattern) === -1 &&
              name.match(pattern)
            )
            .map(pattern => ({ socketId, pattern }))
          ), [])

        if (matches.length === 0) {
          return { history }
        }

        const { socketId, pattern } = matches[Math.floor(Math.random() * matches.length)]

        return {
          history: history.concat(this._serverName + SEP + socketId + SEP + pattern),
          socketId,
          pattern,
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

        socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [ next.pattern, name ])

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

        const { socket } = this._listeners.get(prev.socketId)

        if (!socket) {
          return
        }

        socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ prev.pattern, name ])
      })
  }

  _isLocal (provider) {
    return provider.serverName === this._serverName
  }

  _isRemote (provider) {
    return this._subscriptions.getAllRemoteServers().indexOf(provider.serverName) !== -1
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
