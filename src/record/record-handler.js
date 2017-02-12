const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')
const RecordCache = require('./record-cache')
const xuid = require('xuid')

module.exports = class RecordHandler {

  constructor (options) {
    this._broadcast = this._broadcast.bind(this)
    this._refresh = this._refresh.bind(this)
    this._fetch = this._fetch.bind(this)

    this._onUpdate = this._onUpdate.bind(this)
    this._onRead = this._onRead.bind(this)

    this._logger = options.logger
    this._message = options.messageConnector
    this._storage = options.storageConnector

    this._pending = new Map()
    this._cache = new RecordCache()
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)

    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionMade: (name, socketWrapper, localCount) => {
        if (localCount === 1) {
          this._message.subscribe(`${C.TOPIC.RECORD}.${C.ACTIONS.UPDATE}.${name}`, this._onUpdate)
        }
        this._listenerRegistry.onSubscriptionMade(name, socketWrapper, localCount)
      },
      onSubscriptionRemoved: (name, socketWrapper, localCount, remoteCount) => {
        if (localCount === 0) {
          this._message.unsubscribe(`${C.TOPIC.RECORD}.${C.ACTIONS.UPDATE}.${name}`, this._onUpdate)
        }
        this._listenerRegistry.onSubscriptionRemoved(name, socketWrapper, localCount, remoteCount)
      }
    })

    this._cache.on('added', (name) => {
      this._message.subscribe(`${C.TOPIC.RECORD}.${C.ACTIONS.READ}.${name}`, this._onRead, { queue: C.ACTIONS.READ })
    })
    this._cache.on('removed', (name) => {
      this._message.unsubscribe(`${C.TOPIC.RECORD}.${C.ACTIONS.READ}.${name}`, this._onRead)
    })
  }

  handle (socket, message) {
    const [ name, version, body, parent ] = message && message.data || []
    if (!name) {
      this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ], socket)
    } else if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(name, socket)
    } else if (message.action === C.ACTIONS.READ) {
      this._subscriptionRegistry.subscribe(name, socket)

      if (this._cache.has(name)) {
        socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, this._cache.get(name))
      } else {
        this._refresh([ name ], socket)
      }
    } else if (message.action === C.ACTIONS.UPDATE) {
      this._broadcast([ name, version, body ], socket)
      this._storage.set([ name, version, body, parent ], (error, [ name ]) => {
        if (error) {
          const message = 'error while writing ' + name + ' to storage.'
          this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ name, message ])
        }
      })
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(name, socket)
    } else if (
      message.action === C.ACTIONS.LISTEN ||
      message.action === C.ACTIONS.UNLISTEN ||
      message.action === C.ACTIONS.LISTEN_ACCEPT ||
      message.action === C.ACTIONS.LISTEN_REJECT
    ) {
      this._listenerRegistry.handle(socket, message)
    } else {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, [ name, message.action ])
      this._sendError(socket, C.EVENT.UNKNOWN_ACTION, [ name, 'unknown action ' + message.action ])
    }
  }

  _onUpdate ([ version, body ], topic) {
    const name = topic.slice(topic.lastIndexOf('.') + 1)
    if (!body) {
      this._refresh([ name, version ], C.SOURCE_MESSAGE_CONNECTOR)
    } else {
      this._broadcast([ name, version, body ], C.SOURCE_MESSAGE_CONNECTOR)
    }
  }

  _onRead ([ version, inbox = `${C.TOPIC.RECORD}.${C.ACTIONS.UPDATE}.${name}` ], topic) {
    const name = topic.slice(topic.lastIndexOf('.') + 1)
    const record = this._cache.peek(name)
    if (this._compare(record, version)) {
      this._message.publish(inbox, record.slice(1, 3))
    }
  }

  _broadcast ([ name, version, body ], sender) {
    let record = this._cache.get(name)

    if (this._compare(record, version)) {
      return
    }

    if (record) {
      record[0] = name
      record[1] = version
      record[2] = body
    } else {
      record = [ name, version, body ]
      this._cache.set(name, record)
    }

    this._subscriptionRegistry.sendToSubscribers(
      name,
      messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, record.slice(0, 3)),
      sender
    )

    if (sender !== C.SOURCE_MESSAGE_CONNECTOR) {
      this._message.publish(`${C.TOPIC.RECORD}.${C.ACTIONS.UPDATE}.${name}`, record.slice(1, 3))
    }
  }

  _refresh ([ name, version ], socket) {
    if (this._compare(this._cache.peek(name), version)) {
      return
    }

    if (this._subscriptionRegistry.getLocalSubscribers(name).length === 0) {
      this._cache.del(name)
      return
    }

    const inbox = xuid()
    this._message.subscribe(inbox, this._onUpdate)
    this._message.publish(`${C.TOPIC.RECORD}.${C.ACTIONS.READ}.${name}`, [ version, inbox ])

    const pending = this._pending.get(name)
    if (!pending) {
      const pending = {
        inbox,
        name,
        version,
        sockets: [ socket ]
      }
      this._pending.set(name, pending)
      setTimeout(this._fetch, 200, pending)
    } else {
      pending.sockets.push(socket)
      pending.version = this._compare(version, pending.version) ? version : pending.version
    }
  }

  _fetch ({ name, version, sockets, inbox }) {
    this._pending.delete(name)

    this._message.unsubscribe(inbox, this._onUpdate)

    if (this._compare(this._cache.peek(name), version)) {
      return
    }

    this._storage.get(name, (error, [ name, version, body ], sockets) => {
      if (error) {
        const message = 'error while reading ' + name + ' from storage'
        for (const socket of sockets) {
          this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ name, version, message ])
        }
      } else {
        this._broadcast([ name, version, body ], C.SOURCE_STORAGE_CONNECTOR)
      }
    }, sockets)
  }

  _sendError (socket, event, message) {
    if (socket && socket.sendError) {
      socket.sendError(C.TOPIC.RECORD, event, message)
    } else {
      this._logger.log(C.LOG_LEVEL.ERROR, event, message)
    }
  }

  _compare (a, b) {
    return this._compareVersions(
      typeof a === 'string' ? a : (a && a[1]),
      typeof b === 'string' ? b : (b && b[1])
    )
  }

  _compareVersions (a, b) {
    if (!a) {
      return false
    }
    if (!b) {
      return true
    }
    const [av, ar] = this._splitRev(a)
    const [bv, br] = this._splitRev(b)
    return parseInt(av, 10) > parseInt(bv, 10) || (av === bv && ar >= br)
  }

  _splitRev (s) {
    const i = s.indexOf('-')
    return [ s.slice(0, i), s.slice(i + 1) ]
  }
}
