"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The unique registry is responsible for maintaing a single source of truth
 * within the Server
 *
 */
class LockRegistry {
    /**
    * The unique registry is a singleton and is only created once
    * within deepstream.io. It is passed via
    * via the options object.
    */
    constructor(config, services) {
        this.locks = {};
    }
    /**
    * Requests a lock, if the leader ( whether local or distributed ) has the lock availble
    * it will invoke the callback with true, otherwise false.
    */
    get(name, callback) {
        callback(this.getLock(name));
    }
    /**
    * Release a lock, allowing other resources to request it again
    */
    release(name) {
        delete this.locks[name];
    }
    /**
    * Returns true if reserving lock was possible otherwise returns false
    */
    getLock(name) {
        if (this.locks[name] === true) {
            return false;
        }
        this.locks[name] = true;
        return true;
    }
}
exports.default = LockRegistry;
//# sourceMappingURL=lock-registry.js.map