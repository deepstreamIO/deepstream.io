"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_registry_1 = require("./state-registry");
class ClusterNode {
    constructor(config, services, type) {
        this.stateRegistries = new Map();
    }
    sendDirect(serverName, message, metaData) { }
    sendState() { }
    send(message, metaData) { }
    subscribe(topic, callback) { }
    isLeader() { throw new Error('Leader not used in single state'); }
    getStateRegistry(name) {
        let stateRegistry = this.stateRegistries.get(name);
        if (!stateRegistry) {
            stateRegistry = new state_registry_1.default(name, {});
            this.stateRegistries.set(name, stateRegistry);
        }
        return stateRegistry;
    }
    close(callback) {
        callback();
    }
}
exports.default = ClusterNode;
//# sourceMappingURL=cluster-node.js.map