'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const messageBuilder = require('../message/message-builder')
const xuid = require('xuid')

module.exports = class ListenerRegistry {
  constructor (topic, options, subscriptionRegistry) {
    this._reconcile = this._reconcile.bind(this)
    this._onError = this._onError.bind(this)

    this._listeners = new Map()
    this._timeouts = new Map()
    this._provided = new Set()

    this._topic = topic
    this._listenResponseTimeout = options.listenResponseTimeout
    this._serverName = options.serverName
    this._subscriptionRegistry = subscriptionRegistry
    this._logger = options.logger

    const clusterTopic = `${topic}_${C.TOPIC.LISTEN_PATTERNS}`

    this._providers = options.stateConnector.get(clusterTopic)
    this._providers.watch(this._reconcile)
    this._providerRegistry = new SubscriptionRegistry(options, topic, clusterTopic)
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
    const listener = this._listeners.get(pattern) || { expr: null, sockets: new Map() }

    if (!listener.expr) {
      try {
        listener.expr = new RegExp(pattern)
      } catch (err) {
        socket.sendError(this._topic, C.EVENT.INVALID_MESSAGE_DATA, err.message)
        return
      }
      this._listeners.set(pattern, listener)
    }

    if (socket) {
      listener.sockets.set(socket.uuid, { id: xuid(), socket, pattern })
    }

    this._reconcilePattern(listener.expr)
  }

  onListenRemoved (pattern, socket) {
    const listener = this._listeners.get(pattern)

    if (socket) {
      listener.sockets.delete(socket.uuid)

      if (listener.sockets.size === 0) {
        this._listeners.delete(pattern)
      }
    }

    this._reconcilePattern(listener.expr)
  }

  onSubscriptionAdded (name, socket, localCount, remoteCount) {
    if (localCount + remoteCount === 1) {
      this._reconcile(name)
    }

    if (socket && this._provided.has(name)) {
      this._sendHasProviderUpdate(true, name, socket)
    }
  }

  onSubscriptionRemoved (name, socket, localCount, remoteCount) {
    if (localCount + remoteCount === 0) {
      this._reconcile(name)
    }
  }

  _accept (socket, [ pattern, name ]) {
    clearTimeout(this._timeouts.get(name))
    this._timeouts.delete(name)

    this._providers
      .upsert(name, prev => prev.deadline
        ? {
          uuid: socket.uuid,
          history: prev.history,
          pattern: pattern,
          serverName: this._serverName,
          deadline: null
        } : null
      )
      .then(([ next, prev ]) => {
        if (!next) {
          socket.sendMessage(this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [ pattern, name ])
        }
      })
      .catch(this._onError)
  }

  _reject (socket, [ pattern, name ]) {
    clearTimeout(this._timeouts.get(name))
    this._timeouts.delete(name)

    this._providers
      .upsert(name, prev => prev.uuid === socket.uuid && prev.pattern === pattern
        ? { history: prev.history } : null
      )
      .catch(this._onError)
  }

  _onError (err) {
    this._errorTimeout = this._errorTimeout || setTimeout(() => {
      this._errorTimeout = null
      this._reconcilePattern()
    }, 10000)
    this._logger.log(C.LOG_LEVEL.ERROR, err.message)
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
    return this._providers
      .upsert(name, prev => {
        if (!prev.deadline && this._isAlive(prev)) {
          if (!this._provided.has(name)) {
            this._sendHasProviderUpdate(true, name)
            this._provided.add(name)
          }
        } else if (this._provided.delete(name)) {
          this._sendHasProviderUpdate(false, name)
        }

        if (this._subscriptionRegistry.hasName(name)) {
          if (this._isAlive(prev)) {
            return
          }

          const history = prev.history || []
          const matches = this._match(name).filter(match => !history.includes(match.id))

          if (matches.length === 0) {
            return history.length ? { history } : {}
          }

          const match = matches[Math.floor(Math.random() * matches.length)]

          return {
            history: history.concat(match.id),
            uuid: match.socket.uuid,
            pattern: match.pattern,
            serverName: this._serverName,
            deadline: Date.now() + this._listenResponseTimeout
          }
        } else {
          return prev.uuid && (this._isLocal(prev) || !this._isRemote(prev)) ? {} : null
        }
      })
      .then(([ next, prev ]) => {
        if (!next) {
          return
        }

        if (next.uuid) {
          const listener = this._listeners.get(next.pattern)
          const { socket } = (listener && listener.sockets.get(next.uuid)) || {}

          if (!socket) {
            return
          }

          this._timeouts.set(name, setTimeout(() => this._reconcile(name), this._listenResponseTimeout))

          socket.sendMessage(
            this._topic,
            C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
            [ next.pattern, name ]
          )
        } else if (prev.uuid) {
          const listener = this._listeners.get(prev.pattern)
          const { socket } = (listener && listener.sockets.get(prev.uuid)) || {}

          if (!socket) {
            return
          }

          socket.sendMessage(
            this._topic,
            C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
            [ prev.pattern, name ]
          )
        }
      })
      .catch(this._onError)
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

  _isLocal (provider) {
    return (
      provider &&
      provider.uuid &&
      provider.serverName === this._serverName
    )
  }

  _isRemote (provider) {
    return (
      provider &&
      provider.uuid &&
      provider.serverName !== this._serverName &&
      this._subscriptionRegistry.getAllRemoteServers().indexOf(provider.serverName) !== -1
    )
  }

  _isConnected (provider) {
    if (!provider || !provider.uuid) {
      return false
    } else if (this._isLocal(provider)) {
      const listener = this._listeners.get(provider.pattern)
      return listener && listener.sockets.has(provider.uuid)
    } else {
      return this._isRemote(provider)
    }
  }

  _isAlive (provider) {
    return (
      provider &&
      (!provider.deadline || provider.deadline > Date.now()) &&
      this._isConnected(provider)
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
