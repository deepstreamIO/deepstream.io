'use strict'

const C = require('../constants/constants')

/**
 * This class retrieves a single record from the cache or - if it isn't in the
 * cache - from storage. If it isn't there either it will notify its initiator
 * by passing null to onComplete (but not call onError).
 *
 * It also handles all the timeout and destruction steps around this operation
 *
 * @param {String} recordName       the unique name of the record
 * @param {Object} options        deepstream options
 * @param {SocketWrapper} socketWrapper the sender whos message initiated the recordRequest
 * @param {Function} onComplete       callback for successful requests
 *                                      (even if the record wasn't found)
 * @param {[Function]} onError          callback for errors
 *
 * @constructor
 */
const RecordRequest = function (recordName, options, socketWrapper, onComplete, onError) {
  this._recordName = recordName
  this._options = options
  this._socketWrapper = socketWrapper
  this._storageRetrievalTimeout = null
  this._onComplete = onComplete
  this._onError = onError
  this._isDestroyed = false

  this._cacheRetrievalTimeout = setTimeout(
    this._sendError.bind(this, C.EVENT.CACHE_RETRIEVAL_TIMEOUT, this._recordName),
    this._options.cacheRetrievalTimeout
  )

  this._onCacheResponse = this._onCacheResponse.bind(this)
  this._onStorageResponse = this._onStorageResponse.bind(this)

  this._options.cache.get(this._recordName, this._onCacheResponse)
}

/**
 * Callback for responses returned by the cache connector
 *
 * @param   {String} error  null if no error has occured
 * @param   {Object} record the record data structure, e.g. { _v: 33, _d: { some: 'data' } }
 *
 * @private
 * @returns {void}
 */
RecordRequest.prototype._onCacheResponse = function (error, record) {
  clearTimeout(this._cacheRetrievalTimeout)

  if (this._isDestroyed === true) {
    return
  }

  if (error) {
    this._sendError(C.EVENT.RECORD_LOAD_ERROR, `error while loading ${this._recordName} from cache:${error.toString()}`)
  } else if (record) {
    this._onComplete(record)
  } else if (
      !this._options.storageExclusion ||
      !this._options.storageExclusion.test(this._recordName)
    ) {
    this._storageRetrievalTimeout = setTimeout(
      this._sendError.bind(this, C.EVENT.STORAGE_RETRIEVAL_TIMEOUT, this._recordName),
      this._options.storageRetrievalTimeout
    )
    this._options.storage.get(this._recordName, this._onStorageResponse)
  } else {
    this._onComplete(null)
  }
}

/**
 * Callback for responses returned by the storage connector. The request will complete or error
 * here, if the record couldn't be found in storage no further attempts to retrieve it will be made
 *
 * @param   {String} error  null if no error has occured
 * @param   {Object} record the record data structure, e.g. { _v: 33, _d: { some: 'data' } }
 *
 * @private
 * @returns {void}
 */
RecordRequest.prototype._onStorageResponse = function (error, record) {
  clearTimeout(this._storageRetrievalTimeout)

  if (this._isDestroyed === true) {
    return
  }

  if (error) {
    this._sendError(
      C.EVENT.RECORD_LOAD_ERROR,
      `error while loading ${this._recordName} from storage:${error.toString()}`
    )
  } else {
    this._onComplete(record || null)

    if (record) {
      /*
       * Load record from storage into cache
       */
      this._options.cache.set(this._recordName, record, () => {})
    }

    this._destroy()
  }
}

/**
 * Sends an error to the socketWrapper that requested the
 * record
 *
 * @param   {String} event      Error event
 * @param   {String} message    Error message
 *
 * @private
 * @returns {void}
 */
RecordRequest.prototype._sendError = function (event, message) {
  this._options.logger.log(C.LOG_LEVEL.ERROR, event, message)
  if (this._socketWrapper) {
    this._socketWrapper.sendError(C.TOPIC.RECORD, event, message)
  }
  if (this._onError) {
    this._onError(event, message)
  }
  this._destroy()
}

/**
 * Destroys the record request. Clears down all references and stops
 * all pending timeouts
 *
 * @private
 * @returns {void}
 */
RecordRequest.prototype._destroy = function () {
  clearTimeout(this._cacheRetrievalTimeout)
  clearTimeout(this._storageRetrievalTimeout)
  this._recordName = null
  this._options = null
  this._socketWrapper = null
  this._storageRetrievalTimeout = null
  this._onComplete = null
  this._onError = null
  this._isDestroyed = true
}

module.exports = RecordRequest
