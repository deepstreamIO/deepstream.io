const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')
const utils = require('../utils/utils')
const LRU = require('lru-cache')
const invariant = require('invariant')
const lz = require('lz-string')

const REV_EXPR = /\d+-.+/

const Record = function (version, parent, data) {
  invariant(!version || version.match(REV_EXPR), `invalid argument: version, ${version}`)
  invariant(!parent || parent.match(REV_EXPR), `invalid argument: parent, ${parent}`)
  invariant(typeof data === 'string', `invalid argument: data, ${data}`)

  this._v = version || ''
  this._p = parent || ''
  this._s = data
}

const RecordHandler = function (options) {
  this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
  this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
  this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)
  this._permissionHandler = options.permissionHandler
  this._logger = options.logger
  this._message = options.messageConnector || options.message
  this._storage = options.storageConnector || options.storage
  this._storage.on('change', this._invalidate.bind(this))
  this._recordCache = new LRU({
    max: options.cacheSize || 128e6,
    length (record, recordName) {
      return recordName.length + record._v.length + record._p.length + record._s.length + 64
    }
  })
}

RecordHandler.prototype.handle = function (socketWrapper, message) {
  invariant(arguments.length === 2, 'invalid number of arguments')
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)

  if (!message.data || message.data.length < 1) {
    this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [undefined, message.raw], socketWrapper)
    return
  }

  if (message.action === C.ACTIONS.SUBSCRIBE) {
    this._subscribe(socketWrapper, message)
    return
  }

  if (message.action === C.ACTIONS.READ) {
    this._read(socketWrapper, message)
    return
  }

  if (message.action === C.ACTIONS.UPDATE) {
    this._update(socketWrapper, message)
    return
  }

  if (message.action === C.ACTIONS.UNSUBSCRIBE) {
    this._unsubscribe(socketWrapper, message)
    return
  }

  if (message.action === C.ACTIONS.LISTEN ||
    message.action === C.ACTIONS.UNLISTEN ||
    message.action === C.ACTIONS.LISTEN_ACCEPT ||
    message.action === C.ACTIONS.LISTEN_REJECT) {
    this._listenerRegistry.handle(socketWrapper, message)
    return
  }

  const recordName = message.data[0]

  this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, [ recordName, message.action ])

  this._sendError(socketWrapper, C.EVENT.UNKNOWN_ACTION, [ recordName, 'unknown action ' + message.action ])
}

RecordHandler.prototype._subscribe = function (socketWrapper, message) {
  invariant(arguments.length === 2, 'invalid number of arguments')
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)

  const recordName = message.data[0]

  this._subscriptionRegistry.subscribe(recordName, socketWrapper, true)
}

RecordHandler.prototype._read = function (socketWrapper, message) {
  invariant(arguments.length === 2, 'invalid number of arguments')
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)

  const recordName = message.data[0]

  this._subscriptionRegistry.subscribe(recordName, socketWrapper, true)

  const record = this._recordCache.get(recordName)

  if (record) {
    socketWrapper.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, [
      recordName,
      record._v,
      record._s,
      record._p
    ])
  } else {
    this._refresh(socketWrapper, recordName, null)
  }
}

RecordHandler.prototype._update = function (socketWrapper, message) {
  invariant(arguments.length === 2, 'invalid number of arguments')
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)

  const recordName = message.data[0]

  if (message.data.length < 3) {
    this._sendError(socketWrapper, C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.data ])
    return
  }

  const version = message.data[1]

  if (!version || !version.match(REV_EXPR)) {
    this._sendError(socketWrapper, C.EVENT.INVALID_VERSION, [ recordName, version ])
    return
  }

  const parent = message.data[3]

  if (parent && !parent.match(REV_EXPR)) {
    this._sendError(socketWrapper, C.EVENT.INVALID_VERSION, [ recordName, parent ])
    return
  }

  this._broadcast(socketWrapper, recordName, new Record(
    version,
    parent,
    message.data[2]
  ))

  if (socketWrapper === C.SOURCE_MESSAGE_CONNECTOR) {
    return
  }

  const json = lz.decompressFromUTF16(message.data[2])
  const data = utils.JSONParse(json)

  if (data.error) {
    this._sendError(socketWrapper, C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.data ])
    return
  }

  invariant(data.value && typeof data.value === 'object', `invalid data, ${json}`)

  this._storage.set(recordName, {
    _v: version,
    _p: parent,
    _d: data.value
  }, (error, recordName, record, socketWrapper) => {
    if (error) {
      const message = 'error while writing ' + recordName + ' to storage.'
      this._sendError(socketWrapper, C.EVENT.RECORD_UPDATE_ERROR, [ recordName, message ])
    }
  }, socketWrapper)
}

RecordHandler.prototype._unsubscribe = function (socketWrapper, message) {
  invariant(arguments.length === 2, 'invalid number of arguments')
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)

  const recordName = message.data[0]

  this._subscriptionRegistry.unsubscribe(recordName, socketWrapper, true)
}

RecordHandler.prototype._sendError = function (socketWrapper, event, message) {
  invariant(arguments.length === 3, 'invalid number of arguments')
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)

  if (socketWrapper && socketWrapper.sendError) {
    socketWrapper.sendError(C.TOPIC.RECORD, event, message)
  } else {
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }
}

RecordHandler.prototype._invalidate = function (recordName, version) {
  invariant(arguments.length === 2, 'invalid number of arguments')
  invariant(typeof recordName === 'string', `invalid argument: recordName, ${recordName}`)
  invariant(typeof version === 'string' && version.match(REV_EXPR), `invalid argument: version, ${version}`)

  const prevRecord = this._recordCache.peek(recordName)

  if (prevRecord && utils.compareVersions(prevRecord._v, version)) {
    return
  }

  this._recordCache.del(recordName)

  if (this._subscriptionRegistry.getLocalSubscribers(recordName).length === 0) {
    return
  }

  this._refresh(C.SOURCE_STORAGE_CONNECTOR, recordName)
}

RecordHandler.prototype._refresh = function (socketWrapper, recordName, callback) {
  invariant(arguments.length === 3, 'invalid number of arguments')
  invariant(typeof recordName === 'string', `invalid argument: recordName, ${recordName}`)
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)
  invariant(!callback || typeof callback === 'function', `invalid_argument: callback, ${callback}`)

  this._storage.get(recordName, (error, recordName, record) => {
    invariant(typeof recordName === 'string', `invalid argument: recordName, ${recordName}`)
    invariant(typeof record === 'object', `invalid argument: record, ${record}`)
    invariant(typeof record._d === 'object', `invalid argument: record, ${record}`)

    if (error) {
      const message = 'error while reading ' + recordName + ' from storage'
      this._sendError(socketWrapper, C.EVENT.RECORD_LOAD_ERROR, [ recordName, message ])
      callback && callback(error, recordName)
      return
    }

    record = new Record(
      record._v,
      record._p,
      lz.compressToUTF16(JSON.stringify(record._d))
    )

    record = this._broadcast(null, recordName, record)

    callback && callback(null, recordName, record)
  })
}

RecordHandler.prototype._broadcast = function (socketWrapper, recordName, nextRecord) {
  invariant(arguments.length === 3, 'invalid number of arguments')
  invariant(typeof recordName === 'string', `invalid argument: recordName, ${recordName}`)
  invariant(nextRecord instanceof Record, `invalid argument: nextRecord, ${nextRecord}`)
  invariant(!socketWrapper || typeof socketWrapper === 'string' || socketWrapper.sendError, `invalid argument: socketWrapper, ${socketWrapper}`)

  const prevRecord = this._recordCache.get(recordName)

  if (prevRecord && utils.compareVersions(prevRecord._v, nextRecord._v)) {
    return prevRecord
  }

  this._recordCache.set(recordName, nextRecord)

  if (this._subscriptionRegistry.getLocalSubscribers(recordName).length === 0 &&
      (socketWrapper === C.SOURCE_MESSAGE_CONNECTOR || socketWrapper === C.SOURCE_STORAGE_CONNECTOR)) {
    return nextRecord
  }

  const message = messageBuilder.getMsg(C.TOPIC.RECORD, C.ACTIONS.UPDATE, [
    recordName,
    nextRecord._v,
    nextRecord._s,
    nextRecord._p
  ])

  if (socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR && socketWrapper !== C.SOURCE_STORAGE_CONNECTOR) {
    this._message.publish(C.TOPIC.RECORD, message)
  }

  this._subscriptionRegistry.sendToSubscribers(recordName, message, socketWrapper)

  return nextRecord
}

module.exports = RecordHandler
