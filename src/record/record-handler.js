const C = require(`../constants/constants`)
const SubscriptionRegistry = require(`../utils/subscription-registry`)
const ListenerRegistry = require(`../listen/listener-registry`)
const messageBuilder = require(`../message/message-builder`)
const RecordCache = require(`./record-cache`)

module.exports = class RecordHandler {
  constructor (options) {
    this._update = this._update.bind(this)
    this._read = this._read.bind(this)

    this._logger = options.logger
    this._message = options.messageConnector
    this._storage = options.storageConnector
    this._pending = new Map()
    this._cache = new RecordCache({ max: options.cacheSize || 512e6 })
    this._recordExclusion = options.recordExclusion
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionMade: (name, socketWrapper, localCount) => {
        this._listenerRegistry.onSubscriptionMade(name, socketWrapper, localCount)
        if (socketWrapper && localCount === 1) {
          this._cache.lock(name)
          this._message.subscribe(`RH.U.${name}`, this._update)

          const record = this._cache.peek(name)

          if (!record) {
            this._refresh([ name ])
          }

          this._message.publish(`RH.R`, [ name, record ? record[1] : null ])
        }
      },
      onSubscriptionRemoved: (name, socketWrapper, localCount, remoteCount) => {
        this._listenerRegistry.onSubscriptionRemoved(name, socketWrapper, localCount, remoteCount)
        if (socketWrapper && localCount === 0) {
          this._cache.unlock(name)
          this._message.unsubscribe(`RH.U.${name}`, this._update)
        }
      }
    })

    this._message.subscribe(`RH.R`, this._read)
  }

  handle (socket, message) {
    const data = message && message.data
    if (!data[0]) {
      this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ], socket)
    } else if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(data[0], socket)
    } else if (message.action === C.ACTIONS.READ) {
      this._subscriptionRegistry.subscribe(data[0], socket)
      const record = this._cache.get(data[0])
      if (record) {
        socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, record)
      }
    } else if (message.action === C.ACTIONS.UPDATE) {
      this._broadcast(data, socket)
      if (!this._recordExclusion.test(data[0])) {
        this._cache.lock(data[0])
        this._storage.set(data, (error, record) => {
          if (error) {
            const message = `error while writing ${record[0]} to storage`
            this._sendError(socket, C.EVENT.RECORD_UPDATE_ERROR, [ ...record, message ])
          } else {
            this._cache.unlock(record[0])
          }
        })
      }
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(data[0], socket)
    } else if (
      message.action === C.ACTIONS.LISTEN ||
      message.action === C.ACTIONS.UNLISTEN ||
      message.action === C.ACTIONS.LISTEN_ACCEPT ||
      message.action === C.ACTIONS.LISTEN_REJECT
    ) {
      this._listenerRegistry.handle(socket, message)
    } else {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, [ ...data, message.action ])
      this._sendError(socket, C.EVENT.UNKNOWN_ACTION, [ ...data, `unknown action ${message.action}` ])
    }
  }

  // [ name, ?version, ... ]
  _read (data) {
    const record = this._cache.peek(data[0])

    if (!this._subscriptionRegistry.hasLocalSubscribers(data[0])) {
      this._cache.del(data[0])
    }

    if (!this._compare(data, record)) {
      this._message.publish(`RH.U.${data[0]}`, record)
    }
  }

  // [ name, version, ?body ]
  _update (record) {
    if (record[2]) {
      this._broadcast(record)
    } else if (this._subscriptionRegistry.hasLocalSubscribers(record[0])) {
      this._refresh(record)
    } else {
      this._cache.del(record[0])
    }
  }

  // [ name, ?version, ... ]
  _refresh (next) {
    const version = this._pending.get(next[0])

    if (version && this._compare([ next[0], version ], next)) {
      return
    }

    if (this._pending.size === 0) {
      setTimeout(() => {
        for (const data of this._pending) {
          if (this._compare(this._cache.peek(data[0]), data)) {
            continue
          }
          this._storage.get(data[0], (error, record) => {
            if (error) {
              const message = `error while reading ${data[0]} from storage ${error}`
              this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, message)
            } else if (!this._compare(this._broadcast(record), data)) {
              const message = `error while reading ${data[0]} version ${data[1]} from storage ${error}`
              this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.RECORD_LOAD_ERROR, message)
            }
          })
        }
        this._pending.clear()
      }, 100)
    }

    this._pending.set(next[0], next[1])
  }

  // [ name, version, body, ... ]
  _broadcast (nextRecord, sender = C.SOURCE_MESSAGE_CONNECTOR) {
    const prevRecord = this._cache.peek(nextRecord[0])

    if (this._compare(prevRecord, nextRecord)) {
      return prevRecord
    }

    nextRecord = nextRecord.slice(0, 3)

    this._cache.set(nextRecord[0], nextRecord)

    this._subscriptionRegistry.sendToSubscribers(
      nextRecord[0],
      messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, nextRecord),
      sender
    )

    if (sender !== C.SOURCE_MESSAGE_CONNECTOR) {
      this._message.publish(`RH.U.${nextRecord[0]}`, nextRecord)
    }

    return nextRecord
  }

  _sendError (socket, event, message) {
    if (socket && socket.sendError) {
      socket.sendError(C.TOPIC.RECORD, event, message)
    }
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }

  _compare (a, b) {
    if (!b) {
      return true
    }
    if (!a) {
      return false
    }
    if (!b[1]) {
      return true
    }
    if (!a[1]) {
      return false
    }
    const [av, ar] = this._splitRev(a[1])
    const [bv, br] = this._splitRev(b[1])
    return parseInt(av, 10) > parseInt(bv, 10) || (av === bv && ar >= br)
  }

  _splitRev (s) {
    const i = s.indexOf(`-`)
    return [ s.slice(0, i), s.slice(i + 1) ]
  }
}
