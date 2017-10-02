import { TOPIC, EVENT } from '../constants'

/**
 * Sends an error to the socketWrapper that requested the
 * record
 */
function sendError (
  event: Event, message: string, recordName: string, socketWrapper: SocketWrapper, 
  onError: Function, options: DeepstreamOptions, context: any, metaData: any
):void {
  options.logger.error(event, message, metaData)
  if (onError) {
    onError.call(context, event, message, recordName, socketWrapper)
  } else if (socketWrapper) {
    socketWrapper.sendError({
      topic: TOPIC.RECORD
    }, event)
  }
}

/**
 * Callback for responses returned by the storage connector. The request will complete or error
 * here, if the record couldn't be found in storage no further attempts to retrieve it will be made
 */
function onStorageResponse (
  error: Error, record: StorageRecord, recordName: string, socketWrapper: SocketWrapper, 
  onComplete: Function, onError: Function, options: DeepstreamOptions, context: any, metaData: any
):void {
  if (error) {
    sendError(
      EVENT.RECORD_LOAD_ERROR,
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
 */
function onCacheResponse (
  error: Error, record: StorageRecord, recordName: string, socketWrapper: SocketWrapper, 
  onComplete: Function, onError: Function, options: DeepstreamOptions, context: any, metaData: any
):void {
  if (error) {
    sendError(
      EVENT.RECORD_LOAD_ERROR,
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
        EVENT.STORAGE_RETRIEVAL_TIMEOUT,
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
 */
export default function (
  recordName: string, options: DeepstreamOptions, socketWrapper: SocketWrapper, 
  onComplete: Function, onError: Function, context: any, metaData: any
):void {
  let cacheTimedOut = false

  const cacheTimeout = setTimeout(() => {
    cacheTimedOut = true
    sendError(
      EVENT.CACHE_RETRIEVAL_TIMEOUT,
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
