const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')
const utils = require('../utils/utils')
const LRU = require('lru-cache')
const lz = require('lz-string')

const REV_EXPR = /\d+-.+/

const Record = function (version, parent, body) {
  this._v = version || ''
  this._p = parent || ''
  this._s = typeof body === 'string' ? body : lz.compressToUTF16(JSON.stringify(body))
}

const RecordHandler = function (options) {
  this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
  this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
  this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)
  this._logger = options.logger
  this._message = options.messageConnector
  this._storage = options.storageConnector
  this._storage.changes((name, version) => this._invalidate(C.SOURCE_STORAGE_CONNECTOR, { data: [ name, version ] }))
  this._cache = new LRU({
    max: options.cache && options.cache.size || (128 * 1024 * 1024),
    length (record, name) {
      return name.length + record._v.length + record._p.length + record._s.length + 64
    }
  })
}

RecordHandler.prototype.getRecord = function (name, callback) {
  const record = this._cache.get(name)
  record ? callback(null, name, record) : this._refresh(null, name, callback)
}

RecordHandler.prototype.handle = function (socket, message) {
  if (!message.data || message.data.length < 1) {
    this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [undefined, message.raw], socket)
    return
  }

  if (message.action === C.ACTIONS.READ) {
    this._read(socket, message)
    return
  }

  if (message.action === C.ACTIONS.UPDATE) {
    this._update(socket, message)
    return
  }

  if (message.action === C.ACTIONS.INVALIDATE) {
    this._invalidate(socket, message)
    return
  }

  if (message.action === C.ACTIONS.UNSUBSCRIBE) {
    this._unsubscribe(socket, message)
    return
  }

  if (message.action === C.ACTIONS.LISTEN ||
    message.action === C.ACTIONS.UNLISTEN ||
    message.action === C.ACTIONS.LISTEN_ACCEPT ||
    message.action === C.ACTIONS.LISTEN_REJECT) {
    this._listenerRegistry.handle(socket, message)
    return
  }

  const name = message.data[0]

  this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, [ name, message.action ])

  this._sendError(socket, C.EVENT.UNKNOWN_ACTION, [ name, 'unknown action ' + message.action ])
}

RecordHandler.prototype._read = function (socket, message) {
  const name = message.data[0]

  this._subscriptionRegistry.subscribe(name, socket, true)

  const record = this._cache.get(name)

  if (record) {
    socket.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, [ name, record._v, record._s, record._p ])
  } else {
    this._refresh(socket, name)
  }
}

RecordHandler.prototype._update = function (socket, message) {
  const [ name, version, body, parent ] = message.data

  if (socket !== C.SOURCE_MESSAGE_CONNECTOR) {
    if (message.data.length < 3) {
      this._sendError(socket, C.EVENT.INVALID_MESSAGE_DATA, [ name, message.data ])
      return
    }

    if (!version || !REV_EXPR.test(version)) {
      this._sendError(socket, C.EVENT.INVALID_VERSION, [ name, message.data ])
      return
    }

    if (parent && !REV_EXPR.test(parent)) {
      this._sendError(socket, C.EVENT.INVALID_PARENT, [ name, message.data ])
      return
    }

    const data = utils.JSONParse(lz.decompressFromUTF16(body))

    if (data.error) {
      this._sendError(socket, C.EVENT.INVALID_MESSAGE_DATA, [ name, message.data ])
      return
    }

    this._storage.set(name, {
      _v: version,
      _p: parent,
      _d: data.value
    }, (error, name, record, socket) => {
      if (error) {
        const message = 'error while writing ' + name + ' to storage.'
        this._sendError(socket, C.EVENT.RECORD_UPDATE_ERROR, [ name, message ])
      }
    }, socket)
  }

  this._broadcast(
    socket,
    name,
    message.raw,
    version,
    parent,
    body,
    (name, message, socket) => this._subscriptionRegistry.sendToSubscribers(name, message, socket)
  )
}

RecordHandler.prototype._unsubscribe = function (socket, message) {
  const name = message.data[0]
  this._subscriptionRegistry.unsubscribe(name, socket, true)
}

RecordHandler.prototype._sendError = function (socket, event, message) {
  if (socket && socket.sendError) {
    socket.sendError(C.TOPIC.RECORD, event, message)
  } else {
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }
}

RecordHandler.prototype._invalidate = function (socket, message) {
  const name = message.data[0]
  const version = message.data[1]
  const prevRecord = this._cache.peek(name)

  if (prevRecord && utils.compareVersions(prevRecord._v, version)) {
    return
  }

  this._cache.del(name)

  if (this._subscriptionRegistry.getLocalSubscribers(name).length === 0) {
    return
  }

  this._refresh(socket, name)
}

RecordHandler.prototype._refresh = function (socket, name, callback) {
  this._storage.get(name, (error, name, record, [ socket, callback ]) => {
    if (error) {
      const message = 'error while reading ' + name + ' from storage'
      this._sendError(socket, C.EVENT.RECORD_LOAD_ERROR, [ name, message ])
      return callback && callback(error, name)
    }

    record = this._broadcast(
      socket,
      name,
      null,
      record._v,
      record._p,
      record._d,
      (name, message) => this._subscriptionRegistry.sendToSubscribers(name, message)
    )

    callback && callback(null, name, record)
  }, [ socket, callback ])
}

RecordHandler.prototype._broadcast = function (socket, name, message, version, parent, body, callback) {
  const prevRecord = this._cache.get(name)

  if (prevRecord && utils.compareVersions(prevRecord._v, version)) {
    return prevRecord
  }

  const nextRecord = new Record(version, parent, body)

  this._cache.set(name, nextRecord)

  if (socket !== C.SOURCE_MESSAGE_CONNECTOR && socket !== C.SOURCE_STORAGE_CONNECTOR) {
    this._message.publish(C.TOPIC.RECORD, messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.INVALIDATE, [
      name,
      nextRecord._v
    ]))
  }

  callback(name, message || messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, [
    name,
    nextRecord._v,
    nextRecord._s,
    nextRecord._p
  ]), socket)

  return nextRecord
}

module.exports = RecordHandler
