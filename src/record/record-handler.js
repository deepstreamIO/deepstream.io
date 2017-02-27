const C = require(`../constants/constants`)
const SubscriptionRegistry = require(`../utils/subscription-registry`)
const ListenerRegistry = require(`../listen/listener-registry`)
const messageBuilder = require(`../message/message-builder`)
const LRU = require(`lru-cache`)
const xuid = require(`xuid`)

module.exports = class RecordHandler {

  constructor (options) {
    this._onInvalidate = this._onInvalidate.bind(this)
    this._onRead = this._onRead.bind(this)
    this._onUpdate = this._onUpdate.bind(this)

    this._logger = options.logger
    this._message = options.messageConnector
    this._storage = options.storageConnector
    this._cache = new LRU({
      max: options.cacheSize || 256e6,
      length: record => record[0].length + record[1].length + record[2].length + 64
    })
    this._inbox = xuid()
    this._outbox = xuid()
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)

    this._message.subscribe(`RH.I`, this._onInvalidate)
    this._message.subscribe(`RH.R`, this._onRead)
    this._message.subscribe(`RH.U`, this._onUpdate)
    this._message.subscribe(this._outbox, this._onRead)
    this._message.subscribe(this._inbox, this._onUpdate)
  }

  _onInvalidate ([ name, version, outbox ]) {
    if (this._compare(this._cache.peek(name), version)) {
      return
    }

    if (this._subscriptionRegistry.getLocalSubscribers(name).length === 0) {
      this._cache.del(name)
      return
    }

    this._read([ name, version, outbox ])
  }

  _onRead ([ name, version, inbox ]) {
    const record = this._cache.peek(name)
    if (this._compare(record, version)) {
      this._message.publish(inbox, record)
    }
  }

  _onUpdate (record) {
    this._broadcast(record, C.SOURCE_MESSAGE_CONNECTOR)
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
        this._read(data.slice(0, 2), socket)
      }
    } else if (message.action === C.ACTIONS.UPDATE) {
      this._broadcast(data.slice(0, 3), socket)
      this._storage.set(data.slice(0, 4), (error, record) => {
        if (error) {
          const message = `error while writing ${record[0]} to storage`
          this._sendError(socket, C.EVENT.RECORD_UPDATE_ERROR, [ ...record, message ])
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

  _broadcast (record, sender) {
    if (this._compare(this._cache.peek(record[0]), record)) {
      return
    }

    this._cache.set(record[0], record)

    this._subscriptionRegistry.sendToSubscribers(
      record[0],
      messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, record),
      sender
    )

    if (sender !== C.SOURCE_MESSAGE_CONNECTOR) {
      this._message.publish(`RH.I`, [ record[0], record[1], this._outbox ])
    }
  }

  _read ([ name, version, outbox ], socket) {
    if (outbox) {
      this._message.publish(outbox, [ name, version, this._inbox ])
    } else {
      this._message.publish(`RH.R`, [ name, version, this._inbox ])
      this._storage.get(name, (error, record) => {
        if (error) {
          const message = `error while reading ${record[0]} from storage`
          this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ ...record, message ])
        } else {
          // TODO: Check version
          this._broadcast(record)
        }
      })
    }
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
