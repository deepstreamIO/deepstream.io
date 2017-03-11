const C = require(`../constants/constants`)
const SubscriptionRegistry = require(`../utils/subscription-registry`)
const ListenerRegistry = require(`../listen/listener-registry`)
const messageBuilder = require(`../message/message-builder`)
const RecordCache = require(`./record-cache`)
const utils = require(`../utils/utils`)

module.exports = class RecordHandler {
  constructor (options) {
    this._serverName = options.serverName
    this._logger = options.logger
    this._message = options.messageConnector
    this._storage = options.storageConnector
    this._pending = new Map()
    this._cache = new RecordCache({ max: options.cacheSize || 512e6 })
    this._outbox = `RH.R.${options.serverName}`
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)

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
        const inbox = `RH.U.${data[0]}-${data[1]}`

        let timeout = null
        const next = (record) => {
          clearTimeout(timeout)
          this._message.unsubscribe(inbox, next)

          if (this._compare(this._broadcast(record, C.SOURCE_MESSAGE_CONNECTOR), data)) {
            return
          }

          this._refresh(data, [ C.SOURCE_MESSAGE_CONNECTOR ])
        }

        this._message.subscribe(inbox, next)
        this._message.publish(data[2], [ data[0], data[1], inbox ])
        timeout = setTimeout(next, 100)
      } else {
        this._refresh(data, [ C.SOURCE_MESSAGE_CONNECTOR ])
      }
    })

    // [ name, version, inbox, ... ]
    this._message.subscribe(this._outbox, data => {
      const record = this._cache.peek(data[0])
      this._message.publish(data[2], this._compare(record, data[1]) ? record : record.slice(0, 2))
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
      this._cache.lock(data[0])
      this._storage.set(data, (error, record) => {
        if (error) {
          const message = `error while writing ${record[0]} to storage`
          this._sendError(socket, C.EVENT.RECORD_UPDATE_ERROR, [ ...record, message ])
        } else {
          this._cache.unlock(record[0])
        }
      })
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
  _refresh (data, sockets) {
    this._storage.get(data[0], (error, record, [ data, sockets ]) => {
      if (error) {
        const message = `error while reading ${record[0]} from storage`
        for (const socket of sockets) {
          this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ ...record, message ])
        }
        return
      }

      if (this._compare(this._broadcast(record), data)) {
        return
      }

      // TODO: Avoid infinite loop
      setTimeout(() => this._refresh(data, sockets), 1000)
    }, [ data, sockets ])
  }

  // [ name, version, body, ... ]
  _broadcast (nextRecord, sender) {
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
      this._message.publish(`RH.I`, [ nextRecord[0], nextRecord[1], this._outbox ])
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

    const inbox = `RH.U.${data[0]}`
    const serverNames = utils.shuffle(this._subscriptionRegistry.getAllServers())

    let i = 0
    let timeout = null
    const next = (record) => {
      clearTimeout(timeout)

      if (serverNames[i] === this._serverName) {
        i++
      }

      if (this._broadcast(record, C.SOURCE_MESSAGE_CONNECTOR)) {
        this._pending.delete(data[0])
        this._message.unsubscribe(inbox, next)
      } else if (i < serverNames.length) {
        this._message.publish(`RH.R.${serverNames[i++]}`, [ data[0], null, inbox ])
        timeout = setTimeout(next, 40)
      } else {
        this._pending.delete(data[0])
        this._message.unsubscribe(inbox, next)
        this._refresh(data, sockets)
      }
    }

    this._message.subscribe(inbox, next)

    next()
  }

  _sendError (socket, event, message) {
    if (socket && socket.sendError) {
      socket.sendError(C.TOPIC.RECORD, event, message)
    }
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }

  _compare (a, b) {
    return this._compareVersions(
      typeof a === `string` ? a : (a && a[1]),
      typeof b === `string` ? b : (b && b[1])
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
    const i = s.indexOf(`-`)
    return [ s.slice(0, i), s.slice(i + 1) ]
  }
}
