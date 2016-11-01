const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')
const utils = require('../utils/utils')
const LRU = require('lru-cache')

const RecordHandler = function (options) {
  this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RECORD)
  this._listenerRegistry = new ListenerRegistry(C.TOPIC.RECORD, options, this._subscriptionRegistry)
  this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)
  this._permissionHandler = options.permissionHandler
  this._logger = options.logger
  this._messageConnector = options.messageConnector
  this._storage = options.storage
  this._storage.on('change', this._onStorageChange.bind(this))
  this._cache = new LRU({
    max: (options.cacheSize || 256) * 1e6,
    length: ({ size }, recordName) => size * 1.1 + recordName.length
  })
}

RecordHandler.prototype.handle = function (socketWrapper, message) {
  if (!message.data || message.data.length < 1) {
    this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [undefined, message.raw], socketWrapper)
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

  this._sendError(C.EVENT.UNKNOWN_ACTION, [ recordName, 'unknown action ' + message.action ], socketWrapper)
}

RecordHandler.prototype.getRecord = function (recordName, socketWrapper) {
  const entry = this._cache.get(recordName)
  return entry
    ? Promise.resolve(entry.record)
    : this._getRecordFromStorage(recordName)
        .then(record => this._updateCache(recordName, record, null, socketWrapper))
}

RecordHandler.prototype._read = function (socketWrapper, message) {
  const recordName = message.data[0]

  this
    .getRecord(recordName, socketWrapper)
    .then(record => {
      socketWrapper.sendMessage(C.TOPIC.RECORD, C.ACTIONS.READ, [ recordName, record._v, record._d, record._p ])
      this._subscriptionRegistry.subscribe(recordName, socketWrapper)
    })
    .catch(error => this._sendError(error.event, [ recordName, error.message ], socketWrapper))
}

RecordHandler.prototype._update = function (socketWrapper, message) {
  const recordName = message.data[0]

  if (message.data.length < 4) {
    this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.data[0] ], socketWrapper)
    return
  }

  const version = message.data[1]

  if (!version || !version.match(/\d+-.+/)) {
    this._sendError(C.EVENT.INVALID_VERSION, [ recordName, version ], socketWrapper)
    return
  }

  const parent = message.data[3]

  if (parent && !parent.match(/\d+-.+/)) {
    this._sendError(C.EVENT.INVALID_VERSION, [ recordName, parent ], socketWrapper)
    return
  }

  const data = utils.JSONParse(message.data[2])

  if (data.error) {
    this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.raw ], socketWrapper)
    return
  }

  const record = { _v: version, _d: data.value, _p: parent }

  this._updateCache(recordName, record, message.raw, socketWrapper)

  if (socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR) {
    this._storage.set(recordName, record)
    this._messageConnector.publish(C.TOPIC.RECORD, message)
  }
}

RecordHandler.prototype._unsubscribe = function (socketWrapper, message) {
  const recordName = message.data[0]

  this._subscriptionRegistry.unsubscribe(recordName, socketWrapper)
}

RecordHandler.prototype._sendError = function (event, message, socketWrapper) {
  if (socketWrapper && socketWrapper.sendError) {
    socketWrapper.sendError(C.TOPIC.RECORD, event, message)
  } else {
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }
}

RecordHandler.prototype._getRecordFromStorage = function (recordName) {
  return new Promise((resolve, reject) => this._storage.get(recordName, (error, record) => {
    if (error || !record) {
      const error = new Error('error while loading ' + recordName + ' from storage:' + (error || 'not_found'))
      error.event = C.EVENT.RECORD_LOAD_ERROR
      reject(error)
    } else {
      resolve(record)
    }
  }))
}

RecordHandler.prototype._onStorageChange = function (recordName, version) {
  const entry = this._cache.peek(recordName)

  if (entry && utils.compareVersions(entry.record._v, version)) {
    return
  }

  this
    ._getRecordFromStorage(recordName)
    .then(record => this._updateCache(recordName, record, null, C.SOURCE_STORAGE_CONNECTOR))
    .catch(error => this._logger.log(C.LOG_LEVEL.ERROR, error.event, [ recordName, error.message ]))
}

RecordHandler.prototype._updateCache = function (recordName, record, msgString, socketWrapper) {
  const entry = this._cache.peek(recordName)

  if (entry && utils.compareVersions(entry.record._v, record._v)) {
    return entry.record
  }

  if (!msgString) {
    msgString = messageBuilder.getMsg(
      C.TOPIC.RECORD,
      C.ACTIONS.UPDATE,
      [ recordName, record._v, record._d, record._p ]
    )
  }

  this._subscriptionRegistry.sendToSubscribers(recordName, msgString, socketWrapper)

  this._cache.set(recordName, { record, size: msgString.length })

  return record
}

module.exports = RecordHandler
