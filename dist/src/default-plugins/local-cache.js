"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class LocalCache extends events_1.EventEmitter {
    constructor(config, services) {
        super();
        this.isReady = true;
        this.config = config;
        this.data = {};
        this.description = 'local cache';
    }
    set(key, value, callback) {
        this.data[key] = value;
        process.nextTick(() => callback(null));
    }
    get(key, callback) {
        process.nextTick(() => callback(null, this.data[key] || null));
    }
    delete(key, callback) {
        delete this.data[key];
        process.nextTick(() => callback(null));
    }
}
exports.default = LocalCache;
//# sourceMappingURL=local-cache.js.map