"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class StorageMock {
    constructor() {
        this.reset();
    }
    reset() {
        this.values = {};
        this.failNextSet = false;
        this.nextOperationWillBeSuccessful = true;
        this.nextOperationWillBeSynchronous = true;
        this.nextGetWillBeSynchronous = true;
        this.lastGetCallback = null;
        this.lastRequestedKey = null;
        this.lastSetKey = null;
        this.lastSetValue = null;
        this.completedSetOperations = 0;
        this.completedDeleteOperations = 0;
        this.getCalls = [];
        clearTimeout(this.getTimeout);
        clearTimeout(this.setTimeout);
    }
    delete(key, callback) {
        if (this.nextOperationWillBeSynchronous) {
            this.completedDeleteOperations++;
            if (this.nextOperationWillBeSuccessful) {
                delete this.values[key];
                callback();
            }
            else {
                callback('storageError');
                return;
            }
        }
        else {
            setTimeout(() => {
                this.completedDeleteOperations++;
                callback(this.nextOperationWillBeSuccessful ? null : 'storageError');
            }, 10);
        }
    }
    hadGetFor(key) {
        for (let i = 0; i < this.getCalls.length; i++) {
            if (this.getCalls[i][0] === key) {
                return true;
            }
        }
        return false;
    }
    triggerLastGetCallback(errorMessage, value) {
        this.lastGetCallback(errorMessage, value);
    }
    get(key, callback) {
        this.getCalls.push(arguments);
        this.lastGetCallback = callback;
        this.lastRequestedKey = key;
        const value = this.values[key];
        if (this.nextGetWillBeSynchronous === true) {
            callback(this.nextOperationWillBeSuccessful ? null : 'storageError', value ? Object.assign({}, value) : null);
        }
        else {
            this.getTimeout = setTimeout(() => {
                callback(this.nextOperationWillBeSuccessful ? null : 'storageError', value ? Object.assign({}, value) : null);
            }, 25);
        }
    }
    set(key, value, callback) {
        this.lastSetKey = key;
        this.lastSetValue = value;
        if (value._d === undefined) {
            value = { _v: 0, _d: value };
        }
        if (this.nextOperationWillBeSuccessful) {
            this.values[key] = value;
        }
        if (this.nextOperationWillBeSynchronous) {
            this.completedSetOperations++;
            if (this.failNextSet) {
                this.failNextSet = false;
                callback('storageError');
                return;
            }
            callback(this.nextOperationWillBeSuccessful ? null : 'storageError');
        }
        else {
            this.setTimeout = setTimeout(() => {
                this.completedSetOperations++;
                callback(this.nextOperationWillBeSuccessful ? null : 'storageError');
            }, 50);
        }
    }
}
exports.default = StorageMock;
//# sourceMappingURL=storage-mock.js.map