const C = require(`../constants/constants`)
const SubscriptionRegistry = require(`../utils/subscription-registry`)
const ListenerRegistry = require(`../listen/listener-registry`)
const messageBuilder = require(`../message/message-builder`)
const RecordCache = require(`./record-cache`)
const utils = require(`../utils/utils`)

module.exports = class RecordHandler {
  constructor (options) {
    this._logger = options.logger
    this._message = options.messageConnector
    this._storage = options.storageConnector
    this._pending = new Map()
    this._cache = new RecordCache({ max: options.cacheSize || 512e6 })
    this._recordExclusion = options.recordExclusion
    this._serverName = options.serverName
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionMade: (subscriptionName, socketWrapper, localCount) => {
        this._listenerRegistry.onSubscriptionMade(subscriptionName, socketWrapper, localCount)
        if (socketWrapper && localCount === 1) {
          this._cache.lock(subscriptionName)
        }
      },
      onSubscriptionRemoved: (subscriptionName, socketWrapper, localCount, remoteCount) => {
        this._listenerRegistry.onSubscriptionRemoved(subscriptionName, socketWrapper, localCount, remoteCount)
        if (socketWrapper && localCount === 0) {
          this._cache.unlock(subscriptionName)
        }
      }
    })

    // [ name, version, outbox, ... ]
    this._message.subscribe(`RH.I`, data => {
      if (this._compare(this._cache.peek(data[0]), data)) {
        return
      }

      if (this._subscriptionRegistry.getLocalSubscribers(data[0]).length === 0) {
        this._cache.del(data[0])
        return
      }

      if (data[2]) {
        let timeout = null
        const next = (record) => {
          record = this._broadcast(record)

          if (record && record[0] !== data[0]) {
            return
          }

          this._message.unsubscribe(`RH.U`, next)

          if (!record) {
            this._cache.del(data[0])
            const message = `error while reading ${data[0]} version ${data[1]} from outbox (${data[2]})`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, [ ...record, message ])
          } else if (this._compare(record, data)) {
            clearTimeout(timeout)
          }
        }

        this._message.subscribe(`RH.U`, next)
        this._message.publish(data[2], [ data[0], data[1], `RH.U` ])
        timeout = setTimeout(next, 10000)
      } else {
        this._refresh(data)
      }
    })

    // [ name, version, inbox, ... ]
    this._message.subscribe(`RH.R.${this._serverName}`, data => {
      const record = this._cache.peek(data[0])
      const reply = this._compare(record, data)
        ? record
        : (record ? record.slice(0, 2) : data.slice(0, 1))

      this._message.publish(data[2], reply)
      this._message.publish('RH.U', reply)
    })
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
      } else {
        this._read(data, socket)
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

  // [ name, version, ... ]
  _refresh (data, sockets = [ C.SOURCE_MESSAGE_CONNECTOR ], tries = 30) {
    this._storage.get(data[0], (error, record) => {
      const message = `error while reading ${data[0]} version ${data[1]} from storage ${error}`

      if (error || tries === 0) {
        for (const socket of sockets) {
          this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ ...record, message ])
        }
        return
      }

      record = this._broadcast(record)

      if (this._compare(record, data)) {
        return
      }

      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.RECORD_LOAD_ERROR, message)

      setTimeout(() => this._refresh(data, sockets, tries - 1), 1000)
    })
  }

  // [ name, version, body, ... ]
  _broadcast (nextRecord, sender = C.SOURCE_MESSAGE_CONNECTOR) {
    if (!nextRecord || !nextRecord[2]) {
      return null
    }

    const prevRecord = this._cache.peek(nextRecord[0])

    if (this._compare(prevRecord, nextRecord)) {
      return prevRecord
    }

    this._cache.set(nextRecord[0], nextRecord.slice(0, 3))

    this._subscriptionRegistry.sendToSubscribers(
      nextRecord[0],
      messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, nextRecord),
      sender
    )

    if (sender !== C.SOURCE_MESSAGE_CONNECTOR) {
      this._message.publish(`RH.I`, [ nextRecord[0], nextRecord[1], `RH.R.${this._serverName}` ])
    }

    return nextRecord
  }

  // [ name, ... ]
  _read (data, socket) {
    let sockets = this._pending.get(data[0])

    if (sockets) {
      sockets.add(socket)
      return
    }

    sockets = new Set([ socket ])
    this._pending.set(data[0], sockets)

    const serverNames = utils.shuffle(this._subscriptionRegistry.getAllRemoteServers().slice())

    let i = 0
    let timeout = null
    const next = (record) => {
      if (!record) {
        this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.RECORD_LOAD_ERROR, `cache timeout`)
      }

      record = this._broadcast(record)

      if (record && record[0] !== data[0]) {
        return
      }

      if (record) {
        clearTimeout(timeout)
        this._pending.delete(data[0])
        this._message.unsubscribe(`RH.U`, next)
      } else if (i <= serverNames.length) {
        const serverName = serverNames[i++]
        this._message.publish(`RH.R${serverName ? `.${serverName}` : ''}`, [ data[0], null, `RH.U` ])
        timeout = setTimeout(next, 100)
      } else {
        this._storage.get(data[0], (error, record) => {
          this._pending.delete(data[0])
          this._message.unsubscribe(`RH.U`, next)

          if (error) {
            const message = `error while reading ${data[0]} version ${data[1]} from storage ${error}`
            for (const socket of sockets) {
              this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ ...record, message ])
            }
          } else {
            this._broadcast(record)
          }
        })
      }
    }

    this._message.subscribe(`RH.U`, next)

    next()
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
