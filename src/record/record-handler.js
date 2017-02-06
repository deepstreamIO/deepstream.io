const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')
const messageBuilder = require('../message/message-builder')
const utils = require('../utils/utils')
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
  this._permissionHandler = options.permissionHandler
  this._logger = options.logger
  this._message = options.messageConnector
  this._storage = options.storageConnector
  this._cache = options.cacheConnector
  this._storage.on('change', this._invalidate.bind(this))
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

  this._sendError(socketWrapper, C.EVENT.UNKNOWN_ACTION, [ recordName, 'unknown action ' + message.action ])
}

RecordHandler.prototype._read = function (socketWrapper, message) {
  const recordName = message.data[0]

  this._subscriptionRegistry.subscribe(recordName, socketWrapper, true)

  this._cache.get(recordName, (error, recordName, record) => {
    if (error) {
      const message = 'error while reading ' + recordName + ' from cache'
      this._sendError(socketWrapper, C.EVENT.RECORD_LOAD_ERROR, [ recordName, message ])
      return
    }

    if (record) {
      socketWrapper.sendMessage(C.TOPIC.RECORD, C.ACTIONS.UPDATE, [ recordName, record._v, record._s, record._p ])
    } else {
      this._refresh(socketWrapper, recordName, null)
    }
  })
}

RecordHandler.prototype._update = function (socketWrapper, message) {
  const [ recordName, version, body, parent ] = message.data

  this._broadcast(socketWrapper, recordName, new Record(version, parent, body))

  if (socketWrapper === C.SOURCE_MESSAGE_CONNECTOR) {
    return
  }

  if (message.data.length < 3) {
    this._sendError(socketWrapper, C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.data ])
    return
  }

  if (!version || !REV_EXPR.test(version)) {
    this._sendError(socketWrapper, C.EVENT.INVALID_VERSION, [ recordName, message.data ])
    return
  }

  if (parent && !REV_EXPR.test(parent)) {
    this._sendError(socketWrapper, C.EVENT.INVALID_PARENT, [ recordName, message.data ])
    return
  }

  const json = lz.decompressFromUTF16(body)
  const data = utils.JSONParse(json)

  if (data.error) {
    this._sendError(socketWrapper, C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.data ])
    return
  }

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
  const recordName = message.data[0]
  this._subscriptionRegistry.unsubscribe(recordName, socketWrapper, true)
}

RecordHandler.prototype._sendError = function (socketWrapper, event, message) {
  if (socketWrapper && socketWrapper.sendError) {
    socketWrapper.sendError(C.TOPIC.RECORD, event, message)
  } else {
    this._logger.log(C.LOG_LEVEL.ERROR, event, message)
  }
}

RecordHandler.prototype._invalidate = function (recordName, version) {
  const socketWrapper = C.SOURCE_STORAGE_CONNECTOR

  this._cache.get(recordName, (error, recordName, prevRecord) => {
    if (error) {
      const message = 'error while reading ' + recordName + ' from cache'
      this._sendError(socketWrapper, C.EVENT.RECORD_LOAD_ERROR, [ recordName, message ])
      return
    }

    if (prevRecord && utils.compareVersions(prevRecord._v, version)) {
      return
    }

    this._cache.set(recordName, undefined, (error, recordName) => {
      if (error) {
        const message = 'error while writing ' + recordName + ' to cache'
        this._sendError(socketWrapper, C.EVENT.RECORD_LOAD_ERROR, [ recordName, message ])
        return
      }

      if (this._subscriptionRegistry.getLocalSubscribers(recordName).length === 0) {
        return
      }

      this._refresh(socketWrapper, recordName)
    })
  })
}

RecordHandler.prototype._refresh = function (socketWrapper, recordName) {
  this._storage.get(recordName, (error, recordName, record) => {
    if (error) {
      const message = 'error while reading ' + recordName + ' from storage'
      this._sendError(socketWrapper, C.EVENT.RECORD_LOAD_ERROR, [ recordName, message ])
      return
    }

    this._broadcast(socketWrapper, recordName, new Record(record._v, record._p, record._d))
  })
}

RecordHandler.prototype._broadcast = function (socketWrapper, recordName, nextRecord) {
  this._cache.get(recordName, (error, recordName, prevRecord) => {
    if (error) {
      const message = 'error while reading ' + recordName + ' from cache'
      this._sendError(socketWrapper, C.EVENT.RECORD_LOAD_ERROR, [ recordName, message ])
      return
    }

    if (prevRecord && utils.compareVersions(prevRecord._v, nextRecord._v)) {
      return
    }

    this._cache.set(recordName, nextRecord, (error, recordName) => {
      if (error) {
        const message = 'error while writing ' + recordName + ' to cache'
        this._sendError(socketWrapper, C.EVENT.RECORD_LOAD_ERROR, [ recordName, message ])
        return
      }
    })

    if (this._subscriptionRegistry.getLocalSubscribers(recordName).length === 0 &&
        (socketWrapper === C.SOURCE_MESSAGE_CONNECTOR || socketWrapper === C.SOURCE_STORAGE_CONNECTOR)) {
      return
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
  })
}

module.exports = RecordHandler
