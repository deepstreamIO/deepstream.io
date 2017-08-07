const C = require(`../constants/constants`)
const SubscriptionRegistry = require(`../utils/subscription-registry`)
const ListenerRegistry = require(`../listen/listener-registry`)
const messageBuilder = require(`../message/message-builder`)
const RecordCache = require(`./record-cache`)

module.exports = class RecordHandler {
  constructor (options) {
    this._logger = options.logger
    this._storage = options.storageConnector
    this._cache = new RecordCache({ max: options.cacheSize || 512e6 })
    this._storageExclusion = options.storageExclusion
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionAdded: (name, socket, count) => {
        this._listenerRegistry.onSubscriptionAdded(name, socket, count)
        if (count === 1) {
          this._cache.lock(name)
        }
      },
      onSubscriptionRemoved: (name, socket, count) => {
        this._listenerRegistry.onSubscriptionRemoved(name, socket, count)
        if (count === 0) {
          this._cache.unlock(name)
        }
      }
    })
  }

  handle (socket, message) {
    const data = message && message.data
    if (!data || !data[0]) {
      socket.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ])
    } else if (message.action === C.ACTIONS.READ) {
      this._subscriptionRegistry.subscribe(data[0], socket)
      const record = this._cache.get(data[0])
      if (record && record.message) {
        socket.sendNative(record.message)
      } else if (
        record.message === undefined &&
        (!this._storageExclusion || !this._storageExclusion.test(data[0]))
      ) {
        this._cache.set(data[0], '', '')

        this._storage.get(data[0], (error, nextRecord) => {
          if (error) {
            const message = `error while reading ${nextRecord[0]} from storage ${error}`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, message)
          } else {
            const rawMessage = messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, nextRecord)
            this._broadcast(nextRecord[0], nextRecord[1], rawMessage)
          }
        })
      }
    } else if (message.action === C.ACTIONS.UPDATE) {
      const [ start ] = splitRev(data[1])
      if (
        start > 0 &&
        start < Number.MAX_SAFE_INTEGER &&
        (!this._storageExclusion || !this._storageExclusion.test(data[0]))
      ) {
        this._storage.set(data, (error, data) => {
          if (error) {
            const message = `error while writing ${data[0]} to storage ${error}`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, message)
          }
        }, data)
      }
      this._broadcast(data[0], data[1], message.raw, socket)
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
      socket.sendError(C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, [
        ...(message ? message.data : []),
        `unknown action ${message.action}`
      ])
    }
  }

  _broadcast (name, version, message, sender) {
    const prevRecord = this._cache.get(name)

    if (
      prevRecord &&
      prevRecord.version &&
      isSameOrNewer(prevRecord.version, version)
    ) {
      return
    }

    this._cache.set(name, version, message)

    this._subscriptionRegistry.sendToSubscribers(name, message, sender)
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
