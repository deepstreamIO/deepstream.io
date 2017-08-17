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
    this._storageExclusion = options.storageExclusion || { test: () => false }
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionAdded: (name, socket, count, subscription) => {
        const node = count === 1 ? this._cache.lock(name) : this._cache.get(name)
        if (node && node.message) {
          socket.sendNative(node.message)
        } else if (count === 1 && !this._storageExclusion.test(name)) {
          this._storage.get(name, (error, record) => {
            if (error) {
              const message = `error while reading ${record[0]} from storage ${error}`
              this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, message)
            } else {
              this._broadcast(record, null)
            }
          })
        }

        this._listenerRegistry.onSubscriptionAdded(name, socket, count, subscription)
      },
      onSubscriptionRemoved: (name, socket, count, subscription) => {
        if (count === 0) {
          this._cache.unlock(name)
        }

        this._listenerRegistry.onSubscriptionRemoved(name, socket, count, subscription)
      }
    })
  }

  handle (socket, message) {
    if (!message.data || !message.data[0]) {
      socket.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ])
      return
    }

    if (
      message.action === C.ACTIONS.LISTEN ||
      message.action === C.ACTIONS.UNLISTEN ||
      message.action === C.ACTIONS.LISTEN_ACCEPT ||
      message.action === C.ACTIONS.LISTEN_REJECT
    ) {
      this._listenerRegistry.handle(socket, message)
      return
    }

    const data = message && message.data
    const [ name ] = data

    if (message.action === C.ACTIONS.READ) {
      this._subscriptionRegistry.subscribe(name, socket)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(name, socket)
    } else if (message.action === C.ACTIONS.UPDATE) {
      const record = data
      const [ start ] = splitRev(record[1])
      if (start > 0 && start < Number.MAX_SAFE_INTEGER && !this._storageExclusion.test(name)) {
        this._storage.set(record, (error, record) => {
          if (error) {
            const message = `error while writing ${record[0]} to storage ${error}`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, message)
          }
        }, record)
      }
      this._broadcast(record, socket)
    } else {
      socket.sendError(C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, [
        ...data,
        `unknown action ${message.action}`
      ])
    }
  }

  _broadcast (record, sender) {
    const node = this._cache.get(record[0])

    if (node && node.version && isSameOrNewer(node.version, record[1])) {
      return
    }

    const message = messageBuilder.buildMsg5(
      C.TOPIC.RECORD,
      C.ACTIONS.UPDATE,
      record[0],
      record[1],
      record[2]
    )

    this._cache.set(node, record[0], record[1], message, sender)

    this._subscriptionRegistry.sendToSubscribers(record[0], message, sender)
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
