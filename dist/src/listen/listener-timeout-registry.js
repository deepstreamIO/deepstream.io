"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
class ListenerTimeoutRegistry {
    /**
    * The ListenerTimeoutRegistry is responsible for keeping track of listeners that have
    * been asked whether they want to provide a certain subscription, but have not yet
    * responded.
    */
    constructor(topic, config, services) {
        this.topic = topic;
        this.actions = topic === constants_1.TOPIC.RECORD ? constants_1.RECORD_ACTIONS : constants_1.EVENT_ACTIONS;
        this.config = config;
        this.services = services;
        this.timeoutMap = {};
        this.timedoutProviders = {};
        this.acceptedProvider = {};
    }
    /**
      * The main entry point, which takes a message from a provider
      * that has already timed out and does the following:
      *
      * 1) If reject, remove from map
      * 2) If accept, store as an accepted and reject all following accepts
      */
    handle(socketWrapper, message) {
        const subscriptionName = message.subscription;
        const index = this.getIndex(socketWrapper, message);
        const provider = this.timedoutProviders[subscriptionName][index];
        if (message.action === this.actions.LISTEN_ACCEPT) {
            if (!this.acceptedProvider[subscriptionName]) {
                this.acceptedProvider[subscriptionName] = this.timedoutProviders[subscriptionName][index];
            }
            else {
                provider.socketWrapper.sendMessage({
                    topic: this.topic,
                    action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
                    name: provider.pattern,
                    subscription: subscriptionName,
                });
            }
        }
        else if (message.action === this.actions.LISTEN_REJECT) {
            this.timedoutProviders[subscriptionName].splice(index, 1);
        }
    }
    /**
      * Clear cache once discovery phase is complete
      */
    clear(subscriptionName) {
        delete this.timeoutMap[subscriptionName];
        delete this.timedoutProviders[subscriptionName];
        delete this.acceptedProvider[subscriptionName];
    }
    /**
      * Called whenever a provider closes to ensure cleanup
      */
    removeProvider(socketWrapper) {
        for (const acceptedProvider in this.acceptedProvider) {
            if (this.acceptedProvider[acceptedProvider].socketWrapper === socketWrapper) {
                delete this.acceptedProvider[acceptedProvider];
            }
        }
        for (const subscriptionName in this.timeoutMap) {
            if (this.timeoutMap[subscriptionName]) {
                this.clearTimeout(subscriptionName);
            }
        }
    }
    /**
    * Starts a timeout for a provider. The following cases can apply
    *
    * Provider accepts within the timeout: We stop here
    * Provider rejects within the timeout: We ask the next provider
    * Provider doesn't respond within the timeout: We ask the next provider
    *
    * Provider accepts after the timeout:
    *  If no other provider accepted yet, we'll wait for the current request to end and stop here
    *  If another provider has accepted already, we'll immediatly send a SUBSCRIPTION_REMOVED message
    */
    addTimeout(subscriptionName, provider, callback) {
        const timeoutId = setTimeout(() => {
            if (this.timedoutProviders[subscriptionName] == null) {
                this.timedoutProviders[subscriptionName] = [];
            }
            this.timedoutProviders[subscriptionName].push(provider);
            callback(subscriptionName);
        }, this.config.listenResponseTimeout);
        this.timeoutMap[subscriptionName] = timeoutId;
    }
    /**
      * Clear the timeout for a LISTEN_ACCEPT or LISTEN_REJECt recieved
      * by the listen registry
      */
    clearTimeout(subscriptionName) {
        clearTimeout(this.timeoutMap[subscriptionName]);
        delete this.timeoutMap[subscriptionName];
    }
    /**
      * Return if the socket is a provider that previously timeout
      */
    isALateResponder(socketWrapper, message) {
        const index = this.getIndex(socketWrapper, message);
        return this.timedoutProviders[message.subscription] && index !== -1;
    }
    /**
      * Return if the socket is a provider that previously timeout
      */
    rejectLateResponderThatAccepted(subscriptionName) {
        const provider = this.acceptedProvider[subscriptionName];
        if (provider) {
            provider.socketWrapper.sendMessage({
                topic: this.topic,
                action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
                name: provider.pattern,
                subscription: subscriptionName,
            });
        }
    }
    /**
      * Return if the socket is a provider that previously timeout
      */
    getLateResponderThatAccepted(subscriptionName) {
        return this.acceptedProvider[subscriptionName];
    }
    /**
      * Return if the socket is a provider that previously timeout
      */
    getIndex(socketWrapper, message) {
        const pattern = message.name;
        const subscriptionName = message.subscription;
        const timedoutProviders = this.timedoutProviders[subscriptionName];
        if (timedoutProviders) {
            for (let i = 0; i < timedoutProviders.length; i++) {
                if (timedoutProviders[i].socketWrapper === socketWrapper &&
                    timedoutProviders[i].pattern === pattern) {
                    return i;
                }
            }
        }
        return -1;
    }
}
exports.default = ListenerTimeoutRegistry;
//# sourceMappingURL=listener-timeout-registry.js.map