const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')
const LRU = require('lru-cache')

module.exports = class RecordHandler {

  constructor (options) {
    this._logger = options.logger
    this._message = options.messageConnector
    this._storage = options.storageConnector
    this._cache = new LRU({
      max: 128e6,
      length: record => record[0].length + record[1].length + record[2].length + 64
    })

    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
    this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)

    this._message.subscribe(`${C.TOPIC.RECORD}.${C.ACTIONS.UPDATE}`, record => {
      if (record[2]) {
        this._broadcast(record, C.SOURCE_MESSAGE_CONNECTOR)
        return
      }

      if (this._compare(this._cache.peek(record[0]), record)) {
        return
      }

      if (this._subscriptionRegistry.getLocalSubscribers(record[0]).length === 0) {
        this._cache.del(record[0])
        return
      }

      this._read(record, C.SOURCE_MESSAGE_CONNECTOR)
    })
  }

  handle (socket, message) {
    if (!message && message.data[0]) {
      this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ], socket)
    } else if (message.action === C.ACTIONS.SUBSCRIBE) {
      const [ name ] = message.data
      this._subscriptionRegistry.subscribe(name, socket)
    } else if (message.action === C.ACTIONS.READ) {
      const [ name, version ] = message.data

      this._subscriptionRegistry.subscribe(name, socket)

      const record = this._cache.get(name)
      if (record) {
        socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, record)
      } else {
        this._read([ name, version ], socket)
      }
    } else if (message.action === C.ACTIONS.UPDATE) {
      const [ name, version, body, parent ] = message.data
      this._broadcast([ name, version, body ], socket)
      this._storage.set([ name, version, body, parent ], (error, [ name ]) => {
        if (error) {
          const message = 'error while writing ' + name + ' to storage.'
          this._sendError(socket, C.EVENT.RECORD_UPDATE_ERROR, [ name, message ])
        }
      })
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      const [ name ] = message.data
      this._subscriptionRegistry.unsubscribe(name, socket)
    } else if (
      message.action === C.ACTIONS.LISTEN ||
      message.action === C.ACTIONS.UNLISTEN ||
      message.action === C.ACTIONS.LISTEN_ACCEPT ||
      message.action === C.ACTIONS.LISTEN_REJECT
    ) {
      this._listenerRegistry.handle(socket, message)
    } else {
      const [ name ] = message.data
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, [ name, message.action ])
      this._sendError(socket, C.EVENT.UNKNOWN_ACTION, [ name, 'unknown action ' + message.action ])
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
      this._message.publish(`${C.TOPIC.RECORD}.${C.ACTIONS.UPDATE}`, record)
    }
  }

  _read (record, socket) {
    this._storage.get(record[0], (error, record, [ version, socket ]) => {
      if (error) {
        const message = `error while reading ${record[0]} from storage`
        this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ ...record, message ])
      } else if (this._compare(record, version)) {
        this._broadcast(record)
      } else {
        const message = `error while reading revision ${record[1]} of ${record[0]} from storage`
        this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ ...record, message ])
      }
    }, [ record[1], socket ])
  }

  _sendError (socket, event, message) {
    if (socket && socket.sendError) {
      socket.sendError(C.TOPIC.RECORD, event, message)
    }
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }

  _compare (a, b) {
    return this._compareVersions(
      typeof a === 'string' ? a : (a && a[1]),
      typeof b === 'string' ? b : (b && b[1])
    )
  }

  _compareVersions (a, b) {
    if (!b) {
      return true
    }
    if (!a) {
      return false
    }
    const [av, ar] = this._splitRev(a)
    const [bv, br] = this._splitRev(b)
    return parseInt(av, 10) > parseInt(bv, 10) || (av === bv && ar >= br)
  }

  _splitRev (s) {
    const i = s.indexOf('-')
    return [ s.slice(0, i), s.slice(i + 1) ]
  }

}
