"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
/**
 * Sends an error to the socketWrapper that requested the
 * record
 */
function sendError(event, message, recordName, socketWrapper, onError, services, context, metaData) {
    services.logger.error(event, message, metaData);
    onError.call(context, event, message, recordName, socketWrapper);
}
/**
 * Callback for responses returned by the storage connector. The request will complete or error
 * here, if the record couldn't be found in storage no further attempts to retrieve it will be made
 */
function onStorageResponse(error, record, recordName, socketWrapper, onComplete, onError, services, context, metaData) {
    if (error) {
        sendError(constants_1.RECORD_ACTIONS.RECORD_LOAD_ERROR, `error while loading ${recordName} from storage:${error.toString()}`, recordName, socketWrapper, onError, services, context, metaData);
    }
    else {
        onComplete.call(context, record || null, recordName, socketWrapper);
        if (record) {
            services.cache.set(recordName, record, () => { }, metaData);
        }
    }
}
/**
 * Callback for responses returned by the cache connector
 */
function onCacheResponse(error, record, recordName, socketWrapper, onComplete, onError, config, services, context, metaData) {
    if (error) {
        sendError(constants_1.RECORD_ACTIONS.RECORD_LOAD_ERROR, `error while loading ${recordName} from cache:${error.toString()}`, recordName, socketWrapper, onError, services, context, metaData);
    }
    else if (record) {
        onComplete.call(context, record, recordName, socketWrapper);
    }
    else if (!config.storageExclusion ||
        !config.storageExclusion.test(recordName)) {
        let storageTimedOut = false;
        const storageTimeout = setTimeout(() => {
            storageTimedOut = true;
            sendError(constants_1.RECORD_ACTIONS.STORAGE_RETRIEVAL_TIMEOUT, recordName, recordName, socketWrapper, onError, services, context, metaData);
        }, config.storageRetrievalTimeout);
        services.storage.get(recordName, (storageError, recordData) => {
            if (!storageTimedOut) {
                clearTimeout(storageTimeout);
                onStorageResponse(storageError, recordData, recordName, socketWrapper, onComplete, onError, services, context, metaData);
            }
        }, metaData);
    }
    else {
        onComplete.call(context, null, recordName, socketWrapper);
    }
}
/**
 * This function retrieves a single record from the cache or - if it isn't in the
 * cache - from storage. If it isn't there either it will notify its initiator
 * by passing null to onComplete (but not call onError).
 *
 * It also handles all the timeout and destruction steps around this operation
 */
function default_1(recordName, config, services, socketWrapper, onComplete, onError, context, metaData) {
    let cacheTimedOut = false;
    const cacheTimeout = setTimeout(() => {
        cacheTimedOut = true;
        sendError(constants_1.RECORD_ACTIONS.CACHE_RETRIEVAL_TIMEOUT, recordName, recordName, socketWrapper, onError, services, context, metaData);
    }, config.cacheRetrievalTimeout);
    services.cache.get(recordName, (error, record) => {
        if (!cacheTimedOut) {
            clearTimeout(cacheTimeout);
            onCacheResponse(error, record, recordName, socketWrapper, onComplete, onError, config, services, context, metaData);
        }
    }, metaData);
}
exports.default = default_1;
//# sourceMappingURL=record-request.js.map