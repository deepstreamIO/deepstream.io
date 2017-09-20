'use strict'

const C = require('../constants/constants')

/**
 * Sends an error to the socketWrapper that requested the
 * record
 */
function sendError (
  event, message, recordName, socketWrapper, onError, options, context, metaData
) {
  options.logger.error(event, message, metaData)
  if (socketWrapper) {
    socketWrapper.sendError(C.TOPIC.RECORD, event, message)
  }
  if (onError) {
    onError.call(context, event, message, recordName, socketWrapper)
  }
}

/**
 * Callback for responses returned by the storage connector. The request will complete or error
 * here, if the record couldn't be found in storage no further attempts to retrieve it will be made
 */
function onStorageResponse (
  error, record, recordName, socketWrapper, onComplete, onError, options, context, metaData
) {
  if (error) {
    sendError(
      C.EVENT.RECORD_LOAD_ERROR,
      `error while loading ${recordName} from storage:${error.toString()}`,
      recordName,
      socketWrapper,
      onError,
      options,
      context,
      metaData
    )
  } else {
    onComplete.call(context, record || null, recordName, socketWrapper)

    if (record) {
      options.cache.set(recordName, record, () => {}, metaData)
    }
  }
}

/**
 * Callback for responses returned by the cache connector
 *
 * @private
 * @returns {void}
 */
function onCacheResponse (
  error, record, recordName, socketWrapper, onComplete, onError, options, context, metaData
) {
  if (error) {
    sendError(
      C.EVENT.RECORD_LOAD_ERROR,
      `error while loading ${recordName} from cache:${error.toString()}`,
      recordName,
      socketWrapper,
      onError,
      options,
      context,
      metaData
    )
  } else if (record) {
    onComplete.call(context, record, recordName, socketWrapper)
  } else if (
      !options.storageExclusion ||
      !options.storageExclusion.test(recordName)
    ) {

    let storageTimedOut = false
    const storageTimeout = setTimeout(() => {
      storageTimedOut = true
      sendError(
        C.EVENT.STORAGE_RETRIEVAL_TIMEOUT,
        recordName, recordName, socketWrapper,
        onError, options, context, metaData
      )
    }, options.storageRetrievalTimeout)

    options.storage.get(recordName, (storageError, recordData) => {
      if (!storageTimedOut) {
        clearTimeout(storageTimeout)
        onStorageResponse(
          storageError,
          recordData,
          recordName,
          socketWrapper,
          onComplete,
          onError,
          options,
          context,
          metaData
        )
      }
    }, metaData)
  } else {
    onComplete.call(context, null, recordName, socketWrapper)
  }
}

/**
 * This function retrieves a single record from the cache or - if it isn't in the
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
 */
module.exports = function (
  recordName, options, socketWrapper, onComplete, onError, context, metaData
) {
  let cacheTimedOut = false

  const cacheTimeout = setTimeout(() => {
    cacheTimedOut = true
    sendError(
      C.EVENT.CACHE_RETRIEVAL_TIMEOUT,
      recordName, recordName, socketWrapper,
      onError, options, context, metaData
    )
  }, options.cacheRetrievalTimeout)

  options.cache.get(recordName, (error, record) => {
    if (!cacheTimedOut) {
      clearTimeout(cacheTimeout)
      onCacheResponse(
        error,
        record,
        recordName,
        socketWrapper,
        onComplete,
        onError,
        options,
        context,
        metaData
      )
    }
  }, metaData)
}
