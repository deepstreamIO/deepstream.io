import { SocketWrapper, DeepstreamServices, DeepstreamConfig } from '@deepstream/types'
import { Message, RECORD_ACTION } from '../../constants'
import { isExcluded } from '../../utils/utils'

type onCompleteCallback = (recordName: string, version: number, data: any, socket: SocketWrapper | null, message?: Message) => void
type onErrorCallback = (event: any, errorMessage: string, recordName: string, socket: SocketWrapper | null, message?: Message) => void

/**
 * Sends an error to the socketWrapper that requested the
 * record
 */
function sendError (
  event: RECORD_ACTION, errorMessage: string, recordName: string, socketWrapper: SocketWrapper | null,
  onError: onErrorCallback, services: DeepstreamServices, context: any, metaData?: any, message?: Message,
): void {
  services.logger.error(RECORD_ACTION[event], errorMessage, metaData)
  if (message) {
    onError.call(context, event, errorMessage, recordName, socketWrapper, message)
  } else {
    onError.call(context, event, errorMessage, recordName, socketWrapper)
  }
}

/**
 * Callback for responses returned by the storage connector. The request will complete or error
 * here, if the record couldn't be found in storage no further attempts to retrieve it will be made
 */
function onStorageResponse (
  error: string | null, recordName: string, version: number, data: any, socketWrapper: SocketWrapper | null,
  onComplete: onCompleteCallback, onError: onErrorCallback, services: DeepstreamServices, context: any,
  metaData: any, promoteToCache: boolean, message?: Message
): void {
  if (error) {
    sendError(
      RECORD_ACTION.RECORD_LOAD_ERROR,
      `error while loading ${recordName} from storage:${error}`,
      recordName, socketWrapper, onError, services, context,
      metaData, message
    )
  } else {
    if (message) {
      onComplete.call(context, recordName, version, data || null, socketWrapper, message)
    } else {
      onComplete.call(context, recordName, version, data || null, socketWrapper)
    }

    // Promote to cache is disabled when coming from the record transition
    // since that might override the last set
    if (data && promoteToCache) {
      services.cache.set(recordName, version, data, () => {}, metaData)
    }
  }
}

/**
 * Callback for responses returned by the cache connector
 */
function onCacheResponse (
  error: string | null, recordName: string, version: number, data: any, socketWrapper: SocketWrapper | null,
  onComplete: onCompleteCallback, onError: onErrorCallback, config: DeepstreamConfig, services: DeepstreamServices,
  context: any, metaData: any, promoteToCache: boolean, message?: Message
): void {
  if (error) {
    sendError(
      RECORD_ACTION.RECORD_LOAD_ERROR,
      `error while loading ${recordName} from cache:${error}`,
      recordName, socketWrapper, onError, services, context,
      metaData, message
    )
  } else if (data) {
    if (message) {
      onComplete.call(context, recordName, version, data, socketWrapper, message)
    } else {
      onComplete.call(context, recordName, version, data, socketWrapper)
    }
  } else if (!isExcluded(config.record.storageExclusionPrefixes, recordName)) {
    let storageTimedOut = false
    const storageTimeout = setTimeout(() => {
      storageTimedOut = true
      sendError(
        RECORD_ACTION.STORAGE_RETRIEVAL_TIMEOUT,
        recordName, recordName, socketWrapper,
        onError, services, context, metaData,
        message
      )
    }, config.record.storageRetrievalTimeout)

    // tslint:disable-next-line:no-shadowed-variable
    services.storage.get(recordName, (storageError, version, result) => {
      if (!storageTimedOut) {
        clearTimeout(storageTimeout)
        onStorageResponse(
          storageError, recordName, version!, result, socketWrapper, onComplete,
          onError, services, context, metaData, promoteToCache, message
        )
      }
    }, metaData)
  } else {
    if (message) {
      onComplete.call(context, recordName, version, data, socketWrapper, message)
    } else {
      onComplete.call(context, recordName, version, data, socketWrapper)
    }
  }
}

/**
 * This function retrieves a single record from the cache or - if it isn't in the
 * cache - from storage. If it isn't there either it will notify its initiator
 * by passing null to onComplete (but not call onError).
 *
 * It also handles all the timeout and destruction steps around this operation
 */
export function recordRequest (
  recordName: string,
  config: DeepstreamConfig,
  services: DeepstreamServices,
  socketWrapper: SocketWrapper | null,
  onComplete: onCompleteCallback,
  onError: onErrorCallback,
  context: any,
  metaData?: any,
  message?: Message,
  promoteToCache: boolean = true
): void {
  let cacheTimedOut = false

  const cacheTimeout = setTimeout(() => {
    cacheTimedOut = true
    sendError(
      RECORD_ACTION.CACHE_RETRIEVAL_TIMEOUT,
      recordName, recordName, socketWrapper,
      onError, services, context, metaData,
      message
    )
  }, config.record.cacheRetrievalTimeout)

  services.cache.get(recordName, (error, version, data) => {
    if (!cacheTimedOut) {
      clearTimeout(cacheTimeout)
      onCacheResponse(
        error, recordName, version!, data!,
        socketWrapper, onComplete, onError,
        config, services, context, metaData,
        promoteToCache, message
      )
    }
  }, metaData)
}

export function recordRequestBinding (config: DeepstreamConfig, services: DeepstreamServices, context: any, metaData: any) {
  return function (recordName: string, socketWrapper: SocketWrapper, onComplete: onCompleteCallback, onError: onErrorCallback, message?: Message) {
    recordRequest (recordName, config, services, socketWrapper, onComplete, onError, context, metaData, message)
  }
}
