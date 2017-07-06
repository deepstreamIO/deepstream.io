'use strict'

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
    this._pending = []
    this._cache = new RecordCache({ max: options.cacheSize || 512e6 })
    this._inbox = `RH.U.${options.serverName}`
    this._storageExclusion = options.storageExclusion
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionAdded: (name, socket, localCount, remoteCount) => {
        this._listenerRegistry.onSubscriptionAdded(name, socket, localCount, remoteCount)
        if (socket && localCount === 1) {
          this._cache.lock(name)

          const record = this._cache.peek(name)
          this._message.publish(`RH.R`, [ name, record ? record[1] : undefined, this._inbox ])
        }
      },
      onSubscriptionRemoved: (name, socket, localCount, remoteCount) => {
        this._listenerRegistry.onSubscriptionRemoved(name, socket, localCount, remoteCount)
        if (socket && localCount === 0) {
          this._cache.unlock(name)
        }
      }
    })

    this._message.subscribe(`RH.U`, this._update)
    this._message.subscribe(this._inbox, this._update)
    this._message.subscribe(`RH.R`, this._read)
  }

  handle (socket, message) {
    const data = message && message.data
    if (!data || !data[0]) {
      this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ], socket)
    } else if (message.action === C.ACTIONS.READ) {
      this._subscriptionRegistry.subscribe(data[0], socket)
      const record = this._cache.get(data[0])
      if (record) {
        socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, record)
      } else {
        this._refresh(data)
      }
    } else if (message.action === C.ACTIONS.UPDATE) {
      const [ start ] = splitRev(data[1])
      if (start > 0 && start < Number.MAX_SAFE_INTEGER && (!this._storageExclusion || !this._storageExclusion.test(data[0]))) {
        // TODO: Remove storage exclusion
        this._cache.lock(data[0])
        this._storage.set(data, (error, data) => {
          if (error) {
            const message = `error while writing ${data[0]} to storage`
            this._sendError(socket, C.EVENT.RECORD_UPDATE_ERROR, [ ...data, message ])
          } else {
            this._cache.unlock(data[0])
          }
        }, data)
      }
      this._broadcast(data.slice(0, 3), socket)
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

  // [ name, ?version, inbox ]
  _read ([ name, version, inbox = `RH.U` ]) {
    const record = this._cache.del(name)

    if (!record || isSameOrNewer(version, record[1])) {
      return
    }

    this._message.publish(inbox, record)
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

  // [ name, ?version ]
  _refresh (record) {
    this._pending.push(record)

    if (this._pending.length > 1) {
      return
    }

    setTimeout(() => {
      for (let n = 0; n < this._pending.length; ++n) {
        const [ name, version ] = this._pending[n]

        const prevRecord = this._cache.peek(name)

        if (prevRecord && isSameOrNewer(prevRecord[1], version)) {
          continue
        }

        this._storage.get(name, (error, nextRecord, version) => {
          if (error) {
            const message = `error while reading ${nextRecord[0]} from storage ${error}`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, message)
          }

          this._broadcast(nextRecord)

          if (version && !isSameOrNewer(nextRecord[1], version)) {
            const message = `error while reading ${nextRecord[0]} version ${version} (${nextRecord[1]}) from storage ${error}`
            this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.RECORD_LOAD_ERROR, [ ...nextRecord, message ])
          }
        }, version)
      }

      this._pending = []
    }, 100)
  }

  // [ name, version, body ]
  _broadcast (nextRecord, sender = C.SOURCE_MESSAGE_CONNECTOR) {
    const prevRecord = this._cache.peek(nextRecord[0])

    if (prevRecord && isSameOrNewer(prevRecord[1], nextRecord[1])) {
      return
    }

    this._cache.set(nextRecord[0], nextRecord)

    this._subscriptionRegistry.sendToSubscribers(
      nextRecord[0],
      messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, nextRecord),
      sender
    )

    if (sender !== C.SOURCE_MESSAGE_CONNECTOR) {
      this._message.publish(`RH.U`, nextRecord)
    }
  }

  _sendError (socket, event, message) {
    if (socket && socket.sendError) {
      socket.sendError(C.TOPIC.RECORD, event, message)
    }
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }
}

function isSameOrNewer (a, b) {
  const [ av, ar ] = a ? splitRev(a) : [ 0, '00000000000000' ]
  const [ bv, br ] = b ? splitRev(b) : [ 0, '00000000000000' ]
  return bv !== Number.MAX_SAFE_INTEGER && (av > bv || (av === bv && ar >= br))
}

function splitRev (s) {
  const i = s.indexOf(`-`)
  const ver = s.slice(0, i)
  return [ ver === 'INF' ? Number.MAX_SAFE_INTEGER : parseInt(ver, 10), s.slice(i + 1) ]
}
