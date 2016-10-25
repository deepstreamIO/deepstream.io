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
  this._permissionHandler = this.options.permissionHandler
  this._logger = this.options.logger
  this._messageConnector = this.options.messageConnector
  this._storage = this.options.storage
  this._storage.on('change', this._onStorageChange.bind(this))
  this._cache = new LRU({ max: this.options.cacheSize || 1e6 })
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

RecordHandler.prototype.getRecord = function (recordName) {
  return this._cache.has(recordName)
    ? Promise.resolve(this._cache.get(recordName))
    : this._getRecordFromStorage(recordName)
        .then(record => {
          if (!this._cache.has(recordName)) {
            this._cache.set(recordName, record)
          }
          return record
        })
}

RecordHandler.prototype._read = function (socketWrapper, message) {
  const recordName = message.data[0]
  const permission = this._permissionAction(C.ACTIONS.READ, recordName, socketWrapper)

  permission
    .then(() => this.getRecord(recordName))
    .then(record => {
      this._subscriptionRegistry.subscribe(recordName, socketWrapper)
      socketWrapper.sendMessage(C.TOPIC.RECORD, C.ACTIONS.READ, [ recordName, record._v, record._d, record._p ])
    })
    .catch(error => this._sendError(error.event, [ recordName, error.message ], socketWrapper))
}

RecordHandler.prototype._update = function (socketWrapper, message) {
  const recordName = message.data[0]
  const permission = this._permissionAction(C.ACTIONS.UPDATE, recordName, socketWrapper)

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

  const json = utils.JSONParse(message.data[2])

  if (json.error) {
    this._sendError(C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.raw ], socketWrapper)
    return
  }

  permission
    .then(() => {
      const record = { _v: version, _d: json.value, _p: parent }

      if (socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR) {
        this._storage.set(recordName, record)
      }

      if (!this._isNewer(recordName, version)) {
        return
      }

      this._subscriptionRegistry.sendToSubscribers(recordName, message.raw, socketWrapper)
      this._cache.set(recordName, record)

      if (socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR) {
        this._messageConnector.publish(C.TOPIC.RECORD, message)
      }
    })
    .catch(error => this._sendError(error.event, [recordName, error.message], socketWrapper))
}

RecordHandler.prototype._unsubscribe = function (socketWrapper, message) {
  const recordName = message.data[0]

  this._subscriptionRegistry.unsubscribe(recordName, socketWrapper)
}

RecordHandler.prototype._permissionAction = function (action, recordName, socketWrapper) {
  const message = {
    topic: C.TOPIC.RECORD,
    action: action,
    data: [recordName]
  }

  return new Promise((resolve, reject) => {
    const callback = (error, canPerformAction) => {
      if (error) {
        reject({
          event: C.EVENT.MESSAGE_PERMISSION_ERROR,
          message: error.toString()
        })
      } else if (!canPerformAction) {
        reject({
          event: C.EVENT.MESSAGE_DENIED,
          message: action
        })
      } else {
        resolve()
      }
    }

    this._permissionHandler.canPerformAction(
      socketWrapper.user,
      message,
      callback,
      socketWrapper.authData
    )
  })
}

RecordHandler.prototype._sendError = function (event, message, socketWrapper) {
  if (socketWrapper && socketWrapper.sendError) {
    socketWrapper.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message)
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

RecordHandler.prototype._isNewer = function (recordName, version) {
  return !this._cache.get(recordName) || !utils.compareVersions(this._cache.get(recordName)._v, version)
}

RecordHandler.prototype._onStorageChange = function (recordName, version) {
  if (!this._subscriptionRegistry.hasLocalSubscribers(recordName)) {
    return
  }

  if (!this._isNewer(recordName, version)) {
    return
  }

  this._getRecordFromStorage(recordName)
    .then(record => {
      if (!this._subscriptionRegistry.hasLocalSubscribers(recordName)) {
        return
      }

      if (!this._isNewer(recordName, record._v)) {
        return
      }

      const msgString = messageBuilder.getMsg(
        C.TOPIC.RECORD,
        C.ACTIONS.UPDATE,
        [ recordName, record._v, JSON.stringify(record._d), record._p ]
      )

      this._subscriptionRegistry.sendToSubscribers(recordName, msgString, C.SOURCE_STORAGE_CONNECTOR)
      this._cache.set(recordName, record)
    })
    .catch(error => this._logger.log(C.LOG_LEVEL.ERROR, error.event, [recordName, error.message]))
}

module.exports = RecordHandler
