const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')
const utils = require('../utils/utils')
const LRU = require('lru-cache')

module.exports = class RecordHandler {

  constructor (options) {
    this._read = this._read.bind(this)
    this._refresh = this._refresh.bind(this)
    this._fetch = this._fetch.bind(this)
    this._invalidate = this._invalidate.bind(this)

    this._logger = options.logger
    this._message = options.messageConnector
    this._storage = options.storageConnector

    this._pending = new Map()
    this._cache = new LRU({
      max: 128e6,
      length: ([ name, version, body ]) => name.length + version.length + body.length + 64,
      dispose: (name) => this._message.unsubscribe(buildTopic(C.ACTIONS.READ, name), this._read)
    })
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)

    this._subscriptionRegistry.setSubscriptionListener((() => {
      const broadcast = record => this._broadcast(record, C.SOURCE_MESSAGE_CONNECTOR)
      return {
        onSubscriptionMade: (name, socketWrapper, localCount) => {
          if (localCount === 1) {
            this._message.subscribe(buildTopic(C.ACTIONS.UPDATE, name), broadcast)
          }
          this._listenerRegistry.onSubscriptionMade(name, socketWrapper, localCount)
        },
        onSubscriptionRemoved: (name, socketWrapper, localCount, remoteCount) => {
          if (localCount === 0) {
            this._message.unsubscribe(buildTopic(C.ACTIONS.UPDATE, name), broadcast)
          }
          this._listenerRegistry.onSubscriptionRemoved(name, socketWrapper, localCount, remoteCount)
        }
      }
    })())

    this._storage.changes(this._invalidate)
  }

  handle (socket, message) {
    const record = message && message.data
    if (!record || !record[0]) {
      this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ], socket)
    } else if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(record[0], socket)
    } else if (message.action === C.ACTIONS.READ) {
      this._subscriptionRegistry.subscribe(record[0], socket)

      if (this._cache.has(record[0])) {
        socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, this._cache.get(record[0]))
      } else {
        this._refresh(record, socket)
      }
    } else if (message.action === C.ACTIONS.UPDATE) {
      this._broadcast(record.slice(0, 3), socket)
      this._storage.set(record, (error, name) => {
        if (error) {
          const message = 'error while writing ' + name + ' to storage.'
          this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ name, message ])
        }
      })
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(record[0], socket)
    } else if (message.action === C.ACTIONS.LISTEN ||
      message.action === C.ACTIONS.UNLISTEN ||
      message.action === C.ACTIONS.LISTEN_ACCEPT ||
      message.action === C.ACTIONS.LISTEN_REJECT) {
      this._listenerRegistry.handle(socket, message)
    } else {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, [ record[0], message.action ])
      this._sendError(socket, C.EVENT.UNKNOWN_ACTION, [ record[0], 'unknown action ' + message.action ])
    }
  }

  _broadcast (nextRecord, sender) {
    const prevRecord = this._cache.get(nextRecord[0])

    if (utils.compareVersions(prevRecord && prevRecord[1], nextRecord[1])) {
      return
    }

    if (prevRecord) {
      prevRecord[0] = nextRecord[0]
      prevRecord[1] = nextRecord[1]
      prevRecord[2] = nextRecord[2]
    } else {
      this._message.subscribe(buildTopic(C.ACTIONS.READ, nextRecord[0]), { queue: C.ACTIONS.READ }, this._read)
      this._cache.set(nextRecord[0], nextRecord)
    }

    this._subscriptionRegistry.sendToSubscribers(
      nextRecord[0],
      messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, nextRecord),
      sender
    )

    if (sender) {
      this._message.publish(buildTopic(C.ACTIONS.UPDATE, nextRecord[0]), nextRecord)
    }
  }

  _read (prevRecord) {
    const nextRecord = this._cache.get(prevRecord[1])

    if (utils.compareVersions(prevRecord[1], nextRecord && nextRecord[1])) {
      return
    }

    this._message.publish(buildTopic(C.ACTIONS.UPDATE, nextRecord[0]), nextRecord)
  }

  _refresh (record, socket) {
    this._message.publish(buildTopic(C.ACTIONS.READ, record[0]), record)

    const pending = this._pending.get(record[0])
    if (!pending) {
      const pending = {
        name: record[0],
        version: record[1],
        sockets: [ socket ]
      }
      this._pending.set(record[0], pending)
      setTimeout(this._fetch, 200, pending)
    } else {
      pending.sockets.push(socket)
      pending.version = utils.compareVersions(record[1], pending.version)
        ? record[1]
        : pending.version
    }
  }

  _fetch ({ name, version, sockets }) {
    this._pending.delete(name)

    const prevRecord = this._cache.get(name)

    if (utils.compareVersions(prevRecord && prevRecord[1], version)) {
      return
    }

    this._storage.get(name, (error, record, sockets) => {
      if (error) {
        const message = 'error while reading ' + record[0] + ' from storage'
        for (const socket of sockets) {
          this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ record[0], message ])
        }
      } else {
        this._broadcast(record, C.SOURCE_STORAGE_CONNECTOR)
      }
    }, sockets)
  }

  _invalidate (nextRecord) {
    const prevRecord = this._cache.get(nextRecord[0])

    if (prevRecord && utils.compareVersions(prevRecord[1], nextRecord[1])) {
      return
    }

    if (this._subscriptionRegistry.getLocalSubscribers(nextRecord[0]).length > 0) {
      this._refresh(nextRecord)
    } else {
      this._cache.del(nextRecord[0])
    }
  }

  _sendError (socket, event, message) {
    if (socket && socket.sendError) {
      socket.sendError(C.TOPIC.RECORD, event, message)
    } else {
      this._logger.log(C.LOG_LEVEL.ERROR, event, message)
    }
  }
}

function buildTopic (action, name) {
  return `${C.TOPIC.RECORD}.${action}.${name}`
}
