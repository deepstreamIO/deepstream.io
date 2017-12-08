import { RECORD_ACTIONS, TOPIC } from '../constants'

type onCompleteCallback = (recordName: string, version: number, data: any, socket: SocketWrapper) => void
type onErrorCallback = (event: any, errorMessage: string, recordName: string, socket: SocketWrapper) => void

import { isExcluded } from '../utils/utils'

/**
 * Sends an error to the socketWrapper that requested the
 * record
 */
function sendError (
  event: RECORD_ACTIONS, message: string, recordName: string, socketWrapper: SocketWrapper | null,
  onError: onErrorCallback, services: DeepstreamServices, context: any, metaData: any,
): void {
  services.logger.error(event, message, metaData)
  onError.call(context, event, message, recordName, socketWrapper)
}

/**
 * Callback for responses returned by the storage connector. The request will complete or error
 * here, if the record couldn't be found in storage no further attempts to retrieve it will be made
 */
function onStorageResponse (
  error: string | null, recordName: string, version: number, data: any, socketWrapper: SocketWrapper | null,
  onComplete: onCompleteCallback, onError: onErrorCallback, services: DeepstreamServices, context: any, metaData: any,
): void {
  if (error) {
    sendError(
      RECORD_ACTIONS.RECORD_LOAD_ERROR,
      `error while loading ${recordName} from storage:${error}`,
      recordName,
      socketWrapper,
      onError,
      services,
      context,
      metaData,
    )
  } else {
    onComplete.call(context, recordName, version, data || null, socketWrapper)

    if (data) {
      services.cache.set(recordName, version, data, () => {}, metaData)
    }
  }
}

/**
 * Callback for responses returned by the cache connector
 */
function onCacheResponse (
  error: string | null, recordName: string, version: number, data: any, socketWrapper: SocketWrapper | null,
  onComplete: onCompleteCallback, onError: onErrorCallback, config: DeepstreamConfig, services: DeepstreamServices, context: any, metaData: any,
): void {
  if (error) {
    sendError(
      RECORD_ACTIONS.RECORD_LOAD_ERROR,
      `error while loading ${recordName} from cache:${error}`,
      recordName,
      socketWrapper,
      onError,
      services,
      context,
      metaData,
    )
  } else if (data) {
    onComplete.call(context, recordName, version, data, socketWrapper)
  } else if (!isExcluded(config.storageExclusionPrefixes, recordName)) {
    let storageTimedOut = false
    const storageTimeout = setTimeout(() => {
      storageTimedOut = true
      sendError(
        RECORD_ACTIONS.STORAGE_RETRIEVAL_TIMEOUT,
        recordName, recordName, socketWrapper,
        onError, services, context, metaData,
      )
    }, config.storageRetrievalTimeout)

    // tslint:disable-next-line:no-shadowed-variable
    services.storage.get(recordName, (storageError, version, result) => {
      if (!storageTimedOut) {
        clearTimeout(storageTimeout)
        onStorageResponse(
          storageError,
          recordName,
          version,
          data,
          socketWrapper,
          onComplete,
          onError,
          services,
          context,
          metaData,
        )
      }
    }, metaData)
  } else {
    onComplete.call(context, recordName, version, data, socketWrapper)
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
  recordName: string,
  config: DeepstreamConfig,
  services: DeepstreamServices,
  socketWrapper: SocketWrapper | null,
  onComplete: onCompleteCallback,
  onError: onErrorCallback,
  context: any,
  metaData?: any
): void {
  let cacheTimedOut = false

  const cacheTimeout = setTimeout(() => {
    cacheTimedOut = true
    sendError(
      RECORD_ACTIONS.CACHE_RETRIEVAL_TIMEOUT,
      recordName, recordName, socketWrapper,
      onError, services, context, metaData,
    )
  }, config.cacheRetrievalTimeout)

  services.cache.get(recordName, (error, version, data) => {
    if (!cacheTimedOut) {
      clearTimeout(cacheTimeout)
      onCacheResponse(
        error,
        recordName,
        version,
        data,
        socketWrapper,
        onComplete,
        onError,
        config,
        services,
        context,
        metaData,
      )
    }
  }, metaData)
}
