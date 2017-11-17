"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class NoopStorage extends events_1.EventEmitter {
    constructor(config, services) {
        super();
        this.config = config;
        this.isReady = true;
        this.description = 'noop storage';
    }
    set(key, value, callback) {
        callback(null);
    }
    get(key, callback) {
        callback(null, null);
    }
    delete(key, callback) {
        callback(null);
    }
}
exports.default = NoopStorage;
//# sourceMappingURL=noop-storage.js.map