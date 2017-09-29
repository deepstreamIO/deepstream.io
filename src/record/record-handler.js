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
          this._storage.get(subscription.name, (error, name, version, body) => {
            if (error) {
              const message = `error while reading ${name} from storage ${error}`
              this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_LOAD_ERROR, message)
            } else {
              this._broadcast(name, version, body, messageBuilder.buildMsg5(
                C.TOPIC.RECORD,
                C.ACTIONS.UPDATE,
                name,
                version,
                body
              ))
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
      const [ name, version, body, parent = '' ] = rawMessage
        .slice(UPDATE.length + 1)
        .split(C.MESSAGE_PART_SEPERATOR, 4)

      if (!version.startsWith('INF')) {
        this._storage.set(name, version, body, parent, (error, name) => {
          if (error) {
            const message = `error while writing ${name} to storage ${error}`
            this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, message)
          }
        }, name)
      }
      this._broadcast(name, version, body, rawMessage.slice(0, -(parent.length + 1)), socket)
    } else {
      this._listenerRegistry.handle(socket, rawMessage)
    }
  }

  _broadcast (name, version, body, message, sender) {
    const subscription = this._subscriptionRegistry.getSubscription(name)

    if (!subscription) {
      return
    }

    if (subscription.version && isSameOrNewer(subscription.version, version)) {
      return
    }

    this._listenerRegistry.onUpdate(subscription)

    this._cache.set(subscription, version, message, sender)

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
