const C = require(`../constants/constants`)
const SubscriptionRegistry = require(`../utils/subscription-registry`)
const ListenerRegistry = require(`../listen/listener-registry`)
const messageBuilder = require(`../message/message-builder`)
const RecordCache = require(`./record-cache`)

const READ = [
  C.TOPIC.RECORD,
  C.ACTIONS.READ
].join(C.MESSAGE_PART_SEPERATOR)

const UNSUBSCRIBE = [
  C.TOPIC.RECORD,
  C.ACTIONS.UNSUBSCRIBE
].join(C.MESSAGE_PART_SEPERATOR)

const UPDATE = [
  C.TOPIC.RECORD,
  C.ACTIONS.UPDATE
].join(C.MESSAGE_PART_SEPERATOR)

module.exports = class RecordHandler {
  constructor (options) {
    this._logger = options.logger
    this._storage = options.storageConnector
    this._cache = new RecordCache({ max: options.cacheSize || 512e6 })
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener({
      onSubscriptionAdded: (name, socket, count, subscription, version) => {
        if (version && version === subscription.version) {
          socket.sendNative(messageBuilder.buildMsg3(
            C.TOPIC.RECORD,
            C.ACTIONS.UPDATE,
            name
          ))
        } else if (subscription.message) {
          socket.sendNative(subscription.message)
        } else {
          this._storage.get(subscription.name, (error, record) => {
            if (error) {
              const message = `error while reading ${record[0]} from storage ${error}`
              this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, message)
            } else {
              this._broadcast(record)
            }
          })
        }

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

  handle (socket, rawMessage) {
    if (rawMessage.startsWith(READ)) {
      const [ name, version ] = rawMessage
        .slice(READ.length + 1)
        .split(C.MESSAGE_PART_SEPERATOR, 2)

      this._subscriptionRegistry.subscribe(
        name,
        socket,
        this._cache.ref(name),
        version
      )
    } else if (rawMessage.startsWith(UNSUBSCRIBE)) {
      const name = rawMessage.slice(UNSUBSCRIBE.length + 1)
      this._subscriptionRegistry.unsubscribe(
        name,
        socket
      )
    } else if (rawMessage.startsWith(UPDATE)) {
      const record = rawMessage
        .slice(UPDATE.length + 1)
        .split(C.MESSAGE_PART_SEPERATOR, 4)

      if (!record[1].startsWith('INF')) {
        this._storage.set(record, (error, record) => {
          if (error) {
            const message = `error while writing ${record[0]} to storage ${error}`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, message)
          }
        }, record)
      }
      this._broadcast(record, socket)
    } else {
      this._listenerRegistry.handle(socket, rawMessage)
    }
  }

  _broadcast (record, sender) {
    const subscription = this._subscriptionRegistry.getSubscription(record[0])

    if (!subscription) {
      return
    }

    if (subscription.version && isSameOrNewer(subscription.version, record[1])) {
      return
    }

    this._listenerRegistry.onUpdate(subscription)

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
