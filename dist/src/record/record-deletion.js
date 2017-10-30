"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
class RecordDeletion {
    /**
     * This class represents the deletion of a single record. It handles it's removal
     * from cache and storage and handles errors and timeouts
     */
    constructor(config, services, socketWrapper, message, successCallback, metaData) {
        this.metaData = metaData;
        this.config = config;
        this.services = services;
        this.socketWrapper = socketWrapper;
        this.message = message;
        this.successCallback = successCallback;
        this.recordName = message.name;
        this.completed = 0;
        this.isDestroyed = false;
        this.cacheTimeout = setTimeout(this.handleError.bind(this, 'cache timeout'), this.config.cacheRetrievalTimeout);
        this.services.cache.delete(this.recordName, this.checkIfDone.bind(this, this.cacheTimeout), metaData);
        if (!this.config.storageExclusion || !this.config.storageExclusion.test(this.recordName)) {
            this.storageTimeout = setTimeout(this.handleError.bind(this, 'storage timeout'), this.config.storageRetrievalTimeout);
            this.services.storage.delete(this.recordName, this.checkIfDone.bind(this, this.storageTimeout), metaData);
        }
        else {
            this.checkIfDone(null, null);
        }
    }
    /**
     * Callback for completed cache and storage interactions. Will invoke
     * _done() once both are completed
     */
    checkIfDone(timeoutId, error) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        this.completed++;
        if (this.isDestroyed) {
            return;
        }
        if (error) {
            this.handleError(error.toString());
            return;
        }
        if (this.completed === 2) {
            this.done();
        }
    }
    /**
     * Callback for successful deletions. Notifies the original sender and calls
     * the callback to allow the recordHandler to broadcast the deletion
     */
    done() {
        this.services.logger.info(constants_1.RECORD_ACTIONS[constants_1.RECORD_ACTIONS.DELETE], this.recordName, this.metaData);
        this.socketWrapper.sendAckMessage(this.message);
        this.message = Object.assign({}, this.message, { action: constants_1.RECORD_ACTIONS.DELETED });
        this.successCallback(this.recordName, this.message, this.socketWrapper);
        this.destroy();
    }
    /**
     * Destroyes the class and null down its dependencies
     */
    destroy() {
        clearTimeout(this.cacheTimeout);
        clearTimeout(this.storageTimeout);
        this.isDestroyed = true;
        // this.options = null
        // this.socketWrapper = null
        // this.message = null
    }
    /**
     * Handle errors that occured during deleting the record
     */
    handleError(errorMsg) {
        this.socketWrapper.sendError(this.message, constants_1.RECORD_ACTIONS.RECORD_DELETE_ERROR);
        this.services.logger.error(constants_1.RECORD_ACTIONS[constants_1.RECORD_ACTIONS.RECORD_DELETE_ERROR], errorMsg, this.metaData);
        this.destroy();
    }
}
exports.default = RecordDeletion;
//# sourceMappingURL=record-deletion.js.map