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
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._listenerRegistry.onNoProvider = (subscription) => {
      if (!subscription.message) {
        this._storage.get(subscription.name, (error, record) => {
          if (error) {
            const message = `error while reading ${record[0]} from storage ${error}`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, message)
          } else {
            this._broadcast(record)
          }
        })
      }
    }
    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionAdded: (name, socket, count, subscription) => {
        this._listenerRegistry.onSubscriptionAdded(name, socket, count, subscription)
      },
      onSubscriptionRemoved: (name, socket, count, subscription) => {
        if (count === 0) {
          this._cache.unref(subscription)
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

    const record = message.data

    if (message.action === C.ACTIONS.READ) {
      const subscription = this._subscriptionRegistry.subscribe(
        record[0],
        socket,
        this._cache.ref(record[0])
      )

      if (!subscription) {
        return
      }

      if (record[1] === subscription.version) {
        socket.sendNative(messageBuilder.buildMsg3(
          C.TOPIC.RECORD,
          C.ACTIONS.UPDATE,
          record[0]
        ))
      } else if (subscription.message) {
        socket.sendNative(subscription.message)
      }
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(record[0], socket)
    } else if (message.action === C.ACTIONS.UPDATE) {
      if (record[1].slice(0, 3) !== 'INF') {
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
        ...record,
        `unknown action ${message.action}`
      ])
    }
  }

  _broadcast (record, sender) {
    const subscription = this._subscriptionRegistry.getSubscription(record[0])

    if (!subscription) {
      return
    }

    this._listenerRegistry.onUpdate(subscription)

    if (subscription.version && isSameOrNewer(subscription.version, record[1])) {
      return
    }

    const message = messageBuilder.buildMsg5(
      C.TOPIC.RECORD,
      C.ACTIONS.UPDATE,
      record[0],
      record[1],
      record[2]
    )

    this._cache.set(subscription, record[1], message, sender)

    this._subscriptionRegistry.sendToSubscribers(subscription, message, sender)
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
