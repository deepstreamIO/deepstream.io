"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
/**
 * This class provides a generic mechanism that allows to maintain
 * a distributed state amongst the nodes of a cluster.
 *
 * @extends {EventEmitter}
 *
 * @event 'add' emitted whenever an entry is added for the first time
 * @event 'remove' emitted whenever an entry is removed by the last node
 *
 * @author DeepstreamHub GmbH 2016
 */
class StateRegistry extends events_1.EventEmitter {
    /**
    * Initialises the DistributedStateRegistry and subscribes to the provided cluster topic
    */
    constructor(topic, options) {
        super();
        this.topic = topic;
        this.options = options;
        this.data = {};
    }
    whenReady(callback) {
    }
    /**
    * Checks if a given entry exists within the registry
    */
    has(name) {
        return !!this.data[name];
    }
    /**
    * Add a name/entry to the registry. If the entry doesn't exist yet,
    * this will notify the other nodes within the cluster
    */
    add(name) {
        if (!this.data[name]) {
            this.data[name] = 1;
            this.emit('add', name);
        }
        else {
            this.data[name]++;
        }
    }
    /**
    * Removes a name/entry from the registry. If the entry doesn't exist,
    * this will exit silently
    *
    * @param {String} name any previously added name
    *
    * @public
    * @returns {void}
    */
    remove(name) {
        this.data[name]--;
        if (!this.data[name]) {
            delete this.data[name];
            this.emit('remove', name);
        }
    }
    /**
    * Removes all entries for a given serverName. This is intended to be called
    * whenever a node leaves the cluster
    */
    removeAll(serverName) {
    }
    /**
    * Returns all the servers that hold a given state
    */
    getAllServers(subscriptionName) {
        return [];
    }
    /**
    * Returns all currently registered entries
    *
    * @public
    * @returns {Array} entries
    */
    getAll() {
        return Object.keys(this.data);
    }
    getAllMap() {
        return this.data;
    }
}
exports.default = StateRegistry;
//# sourceMappingURL=state-registry.js.map