"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const subscription_registry_1 = require("../utils/subscription-registry");
const utils_1 = require("../utils/utils");
const listener_timeout_registry_1 = require("./listener-timeout-registry");
class ListenerRegistry {
    /**
    * Deepstream.io allows clients to register as listeners for subscriptions.
    * This allows for the creation of 'active' data-providers,
    * e.g. data providers that provide data on the fly, based on what clients
    * are actually interested in.
    *
    * When a client registers as a listener, it provides a regular expression.
    * It will then immediatly get a number of callbacks for existing record subscriptions
    * whose names match that regular expression.
    *
    * After that, whenever a record with a name matching that regular expression is subscribed
    * to for the first time, the listener is notified.
    *
    * Whenever the last subscription for a matching record is removed, the listener is also
    * notified with a SUBSCRIPTION_FOR_PATTERN_REMOVED action
    *
    * This class manages the matching of patterns and record names. The subscription /
    * notification logic is handled by this.providerRegistry
    */
    constructor(topic, config, services, clientRegistry, metaData) {
        this.metaData = metaData;
        this.topic = topic;
        this.actions = topic === constants_1.TOPIC.RECORD ? constants_1.RECORD_ACTIONS : constants_1.EVENT_ACTIONS;
        this.config = config;
        this.services = services;
        this.clientRegistry = clientRegistry;
        this.uniqueLockName = `${topic}_LISTEN_LOCK`;
        this.message = this.services.message;
        this.patterns = {};
        this.localListenInProgress = {};
        this.listenerTimeoutRegistry = new listener_timeout_registry_1.default(topic, config, services);
        this.locallyProvidedRecords = {};
        this.leadListen = {};
        this.leadingListen = {};
        this.setupProviderRegistry();
        this.setupRemoteComponents();
    }
    /**
     * Setup all the remote components and actions required to deal with the subscription
     * via the cluster.
     */
    setupProviderRegistry() {
        if (this.topic === constants_1.TOPIC.RECORD) {
            this.providerRegistry = new subscription_registry_1.default(this.config, this.services, this.topic, constants_1.TOPIC.RECORD_LISTEN_PATTERNS);
        }
        else {
            this.providerRegistry = new subscription_registry_1.default(this.config, this.services, this.topic, constants_1.TOPIC.EVENT_LISTEN_PATTERNS);
        }
        this.providerRegistry.setAction('subscribe', this.actions.LISTEN);
        this.providerRegistry.setAction('unsubscribe', this.actions.UNLISTEN);
        this.providerRegistry.setSubscriptionListener({
            onLastSubscriptionRemoved: this.removeLastPattern.bind(this),
            onSubscriptionRemoved: this.removePattern.bind(this),
            onFirstSubscriptionMade: this.addPattern.bind(this),
            onSubscriptionMade: () => { },
        });
    }
    /**
     * Setup all the remote components and actions required to deal with the subscription
     * via the cluster.
     */
    setupRemoteComponents() {
        if (this.topic === constants_1.TOPIC.RECORD) {
            this.clusterProvidedRecords = this.message.getStateRegistry(constants_1.TOPIC.RECORD_PUBLISHED_SUBSCRIPTIONS);
            this.messageTopic = constants_1.TOPIC.RECORD_LISTENING;
        }
        else {
            this.clusterProvidedRecords = this.message.getStateRegistry(constants_1.TOPIC.EVENT_PUBLISHED_SUBSCRIPTIONS);
            this.messageTopic = constants_1.TOPIC.EVENT_LISTENING;
        }
        this.clusterProvidedRecords.on('add', this.onRecordStartProvided.bind(this));
        this.clusterProvidedRecords.on('remove', this.onRecordStopProvided.bind(this));
        this.message.subscribe(this.messageTopic, this.onIncomingMessage.bind(this));
    }
    /**
    * Returns whether or not a provider exists for
    * the specific subscriptionName
    */
    hasActiveProvider(susbcriptionName) {
        return this.clusterProvidedRecords.has(susbcriptionName);
    }
    /**
    * The main entry point to the handle class.
    * Called on any of the following actions:
    *
    * 1) ACTIONS.LISTEN
    * 2) ACTIONS.UNLISTEN
    * 3) ACTIONS.LISTEN_ACCEPT
    * 4) ACTIONS.LISTEN_REJECT
    */
    handle(socketWrapper, message) {
        const subscriptionName = message.subscription;
        if (message.action === this.actions.LISTEN) {
            this.addListener(socketWrapper, message);
            return;
        }
        if (message.action === this.actions.UNLISTEN) {
            this.providerRegistry.unsubscribe(message, socketWrapper);
            this.removeListener(socketWrapper, message);
            return;
        }
        if (this.listenerTimeoutRegistry.isALateResponder(socketWrapper, message)) {
            this.listenerTimeoutRegistry.handle(socketWrapper, message);
            return;
        }
        if (this.localListenInProgress[subscriptionName]) {
            this.processResponseForListenInProgress(socketWrapper, subscriptionName, message);
            return;
        }
    }
    /**
    * Handle messages that arrive via the message bus
    *
    * This can either be messages by the leader indicating that this
    * node is responsible for starting a local discovery phase
    * or from a resulting node with an ACK to allow the leader
    * to move on and release its lock
    */
    onIncomingMessage(message) {
        // if (this.config.serverName !== message.data[0]) {
        //   return
        // }
        // if (message.action === ACTIONS.LISTEN) {
        //   this.leadListen[message.data[1]] = message.data[2]
        //   this.startLocalDiscoveryStage(message.data[1])
        // } else if (message.isAck) {
        //   this.nextDiscoveryStage(message.data[1])
        // }
    }
    /**
    * Process an accept or reject for a listen that is currently in progress
    * and hasn't timed out yet.
    */
    processResponseForListenInProgress(socketWrapper, subscriptionName, message) {
        if (message.action === this.actions.LISTEN_ACCEPT) {
            this.accept(socketWrapper, message);
            this.listenerTimeoutRegistry.rejectLateResponderThatAccepted(subscriptionName);
            this.listenerTimeoutRegistry.clear(subscriptionName);
        }
        else if (message.action === this.actions.LISTEN_REJECT) {
            const provider = this.listenerTimeoutRegistry.getLateResponderThatAccepted(subscriptionName);
            if (provider) {
                this.accept(provider.socketWrapper, message);
                this.listenerTimeoutRegistry.clear(subscriptionName);
            }
            else {
                this.triggerNextProvider(subscriptionName);
            }
        }
    }
    /**
    * Called by the record subscription registry whenever a subscription count goes down to zero
    * Part of the subscriptionListener interface.
    */
    onFirstSubscriptionMade(subscriptionName) {
        this.startDiscoveryStage(subscriptionName);
    }
    onSubscriptionMade(subscriptionName, socketWrapper) {
        if (this.hasActiveProvider(subscriptionName)) {
            this.sendHasProviderUpdateToSingleSubscriber(true, socketWrapper, subscriptionName);
            return;
        }
    }
    onLastSubscriptionRemoved(subscriptionName) {
        const provider = this.locallyProvidedRecords[subscriptionName];
        if (!provider) {
            return;
        }
        this.sendSubscriptionForPatternRemoved(provider, subscriptionName);
        this.removeActiveListener(subscriptionName);
    }
    /**
    * Called by the record subscription registry whenever the subscription count increments.
    * Part of the subscriptionListener interface.
    */
    onSubscriptionRemoved(subscriptionName, socketWrapper) {
    }
    /**
    * Register callback for when the server recieves an accept message from the client
    */
    accept(socketWrapper, message) {
        const subscriptionName = message.subscription;
        this.listenerTimeoutRegistry.clearTimeout(subscriptionName);
        this.locallyProvidedRecords[subscriptionName] = {
            socketWrapper,
            pattern: message.name,
            closeListener: this.removeListener.bind(this, socketWrapper, message),
        };
        socketWrapper.once('close', this.locallyProvidedRecords[subscriptionName].closeListener);
        this.stopLocalDiscoveryStage(subscriptionName);
        this.clusterProvidedRecords.add(subscriptionName);
    }
    /**
    * Register a client as a listener for record subscriptions
    */
    addListener(socketWrapper, message) {
        const regExp = this.validatePattern(socketWrapper, message);
        if (!regExp) {
            return;
        }
        this.providerRegistry.subscribe(message, socketWrapper);
        this.reconcileSubscriptionsToPatterns(regExp, message.name, socketWrapper);
    }
    /**
    * Find subscriptions that match pattern, and notify them that
    * they can be provided.
    *
    * We will attempt to notify all possible providers rather than
    * just the single provider for load balancing purposes and
    * so that the one listener doesnt potentially get overwhelmed.
    */
    reconcileSubscriptionsToPatterns(regExp, pattern, socketWrapper) {
        const names = this.clientRegistry.getNames();
        for (let i = 0; i < names.length; i++) {
            const subscriptionName = names[i];
            if (this.locallyProvidedRecords[subscriptionName]) {
                continue;
            }
            if (!subscriptionName.match(regExp)) {
                continue;
            }
            const listenInProgress = this.localListenInProgress[subscriptionName];
            if (listenInProgress) {
                listenInProgress.push({ socketWrapper, pattern });
            }
            else {
                this.startDiscoveryStage(subscriptionName);
            }
        }
    }
    /**
    * De-register a client as a listener for record subscriptions
    */
    removeListener(socketWrapper, message) {
        const pattern = message.name;
        this.removeListenerFromInProgress(this.localListenInProgress, pattern, socketWrapper);
        this.removeListenerIfActive(pattern, socketWrapper);
    }
    /**
    * Removes the listener if it is the currently active publisher, and retriggers
    * another listener discovery phase
    */
    removeListenerIfActive(pattern, socketWrapper) {
        for (const subscriptionName in this.locallyProvidedRecords) {
            const provider = this.locallyProvidedRecords[subscriptionName];
            if (provider.socketWrapper === socketWrapper &&
                provider.pattern === pattern) {
                provider.socketWrapper.removeListener('close', provider.closeListener);
                this.removeActiveListener(subscriptionName);
                if (this.clientRegistry.hasLocalSubscribers(subscriptionName)) {
                    this.startDiscoveryStage(subscriptionName);
                }
            }
        }
    }
    /**
      */
    removeActiveListener(subscriptionName) {
        delete this.locallyProvidedRecords[subscriptionName];
        this.clusterProvidedRecords.remove(subscriptionName);
    }
    /**
    * Start discovery phase once a lock is obtained from the leader within
    * the cluster
    */
    startDiscoveryStage(subscriptionName) {
        const localListenArray = this.createLocalListenArray(subscriptionName);
        if (localListenArray.length === 0) {
            return;
        }
        this.services.uniqueRegistry.get(this.getUniqueLockName(subscriptionName), success => {
            if (!success) {
                return;
            }
            if (this.hasActiveProvider(subscriptionName)) {
                this.services.uniqueRegistry.release(this.getUniqueLockName(subscriptionName));
                return;
            }
            this.services.logger.debug(constants_1.EVENT.LEADING_LISTEN, `started for ${this.topic}:${subscriptionName}`, this.metaData);
            const remoteListenArray = this.createRemoteListenArray(subscriptionName);
            this.leadingListen[subscriptionName] = remoteListenArray;
            this.startLocalDiscoveryStage(subscriptionName, localListenArray);
        });
    }
    /**
    * called when a subscription has been provided to clear down the discovery stage,
    * or when an ack has been recieved via the message bus
    */
    nextDiscoveryStage(subscriptionName) {
        if (this.hasActiveProvider(subscriptionName) ||
            this.leadingListen[subscriptionName].length === 0) {
            this.services.logger.debug(constants_1.EVENT.LEADING_LISTEN, `finished for ${this.topic}:${subscriptionName}`, this.metaData);
            delete this.leadingListen[subscriptionName];
            this.services.uniqueRegistry.release(this.getUniqueLockName(subscriptionName));
        }
        else {
            const nextServerName = this.leadingListen[subscriptionName].shift();
            this.services.logger.debug(constants_1.EVENT.LEADING_LISTEN, `started for ${this.topic}:${subscriptionName}`, this.metaData);
            this.sendRemoteDiscoveryStart(nextServerName, subscriptionName);
        }
    }
    /**
    * Start discovery phase once a lock is obtained from the leader within
    * the cluster
    */
    startLocalDiscoveryStage(subscriptionName, localListenArray) {
        if (!localListenArray) {
            localListenArray = this.createLocalListenArray(subscriptionName);
        }
        if (localListenArray.length > 0) {
            this.services.logger.debug(constants_1.EVENT.LOCAL_LISTEN, `started for ${this.topic}:${subscriptionName}`, this.metaData);
            this.localListenInProgress[subscriptionName] = localListenArray;
            this.triggerNextProvider(subscriptionName);
        }
    }
    /**
    * Finalises a local listener discovery stage
    */
    stopLocalDiscoveryStage(subscriptionName) {
        delete this.localListenInProgress[subscriptionName];
        this.services.logger.debug(constants_1.EVENT.LOCAL_LISTEN, `stopped for ${this.topic}:${subscriptionName}`, this.metaData);
        if (this.leadingListen[subscriptionName]) {
            this.nextDiscoveryStage(subscriptionName);
        }
        else if (this.leadListen[subscriptionName]) {
            this.sendRemoteDiscoveryStop(this.leadListen[subscriptionName], subscriptionName);
            delete this.leadListen[subscriptionName];
        }
        else {
            this.services.logger.warn(constants_1.EVENT.LOCAL_LISTEN, `nothing to stop for ${this.topic}:${subscriptionName}`, this.metaData);
        }
    }
    /**
    * Trigger the next provider in the map of providers capable of publishing
    * data to the specific subscriptionName
    */
    triggerNextProvider(subscriptionName) {
        const listenInProgress = this.localListenInProgress[subscriptionName];
        if (typeof listenInProgress === 'undefined') {
            return;
        }
        if (listenInProgress.length === 0) {
            this.stopLocalDiscoveryStage(subscriptionName);
            return;
        }
        const provider = listenInProgress.shift();
        const subscribers = this.clientRegistry.getLocalSubscribers(subscriptionName);
        if (subscribers && subscribers.has(provider.socketWrapper)) {
            this.stopLocalDiscoveryStage(subscriptionName);
            return;
        }
        this.listenerTimeoutRegistry.addTimeout(subscriptionName, provider, this.triggerNextProvider.bind(this));
        this.sendSubscriptionForPatternFound(provider, subscriptionName);
    }
    /**
    * Triggered when a subscription is being provided by a node in the cluster
    */
    onRecordStartProvided(subscriptionName) {
        this.sendHasProviderUpdate(true, subscriptionName);
        if (this.leadingListen[subscriptionName]) {
            this.nextDiscoveryStage(subscriptionName);
        }
    }
    /**
    * Triggered when a subscription is stopped being provided by a node in the cluster
    */
    onRecordStopProvided(subscriptionName) {
        this.sendHasProviderUpdate(false, subscriptionName);
        if (!this.hasActiveProvider(subscriptionName) &&
            this.clientRegistry.hasName(subscriptionName)) {
            this.startDiscoveryStage(subscriptionName);
        }
    }
    /**
    * Compiles a regular expression from an incoming pattern
    */
    addPattern(pattern) {
        if (!this.patterns[pattern]) {
            this.patterns[pattern] = new RegExp(pattern);
        }
    }
    /**
    * Deletes the pattern regex when removed
    */
    removePattern(pattern, socketWrapper) {
        this.listenerTimeoutRegistry.removeProvider(socketWrapper);
        this.removeListenerFromInProgress(this.localListenInProgress, pattern, socketWrapper);
        this.removeListenerIfActive(pattern, socketWrapper);
    }
    removeLastPattern(pattern) {
        delete this.patterns[pattern];
    }
    /**
    * Remove provider from listen in progress map if it unlistens during
    * discovery stage
    */
    removeListenerFromInProgress(listensCurrentlyInProgress, pattern, socketWrapper) {
        for (const subscriptionName in listensCurrentlyInProgress) {
            const listenInProgress = listensCurrentlyInProgress[subscriptionName];
            for (let i = 0; i < listenInProgress.length; i++) {
                if (listenInProgress[i].socketWrapper === socketWrapper &&
                    listenInProgress[i].pattern === pattern) {
                    listenInProgress.splice(i, 1);
                }
            }
        }
    }
    /**
    * Sends a has provider update to a single subcriber
    */
    sendHasProviderUpdateToSingleSubscriber(hasProvider, socketWrapper, subscriptionName) {
        if (socketWrapper && this.topic === constants_1.TOPIC.RECORD) {
            socketWrapper.sendMessage({
                topic: this.topic,
                action: this.actions.SUBSCRIPTION_HAS_PROVIDER,
                name: subscriptionName,
                parsedData: hasProvider,
            });
        }
    }
    /**
    * Sends a has provider update to all subcribers
    */
    sendHasProviderUpdate(hasProvider, subscriptionName) {
        if (this.topic !== constants_1.TOPIC.RECORD) {
            return;
        }
        this.clientRegistry.sendToSubscribers(subscriptionName, {
            topic: this.topic,
            action: this.actions.SUBSCRIPTION_HAS_PROVIDER,
            name: subscriptionName,
            parsedData: hasProvider,
        }, false, null);
    }
    /**
    * Sent by the listen leader, and is used to inform the next server in the cluster to
    * start a local discovery
    */
    sendRemoteDiscoveryStart(serverName, subscriptionName) {
        this.message.sendDirect(serverName, {
            topic: this.messageTopic,
            action: this.actions.LISTEN,
            name: subscriptionName,
        }, this.metaData);
    }
    /**
    * Sent by the listen follower, and is used to inform the leader that it has
    * complete its local discovery start
    */
    sendRemoteDiscoveryStop(listenLeaderServerName, subscriptionName) {
        this.message.sendDirect(listenLeaderServerName, {
            topic: this.messageTopic,
            action: this.actions.ACK,
            name: subscriptionName,
        }, this.metaData);
    }
    /**
    * Send a subscription found to a provider
    */
    sendSubscriptionForPatternFound(provider, subscriptionName) {
        provider.socketWrapper.sendMessage({
            topic: this.topic,
            action: this.actions.SUBSCRIPTION_FOR_PATTERN_FOUND,
            name: provider.pattern,
            subscription: subscriptionName,
        });
    }
    /**
    * Send a subscription removed to a provider
    */
    sendSubscriptionForPatternRemoved(provider, subscriptionName) {
        provider.socketWrapper.sendMessage({
            topic: this.topic,
            action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
            name: provider.pattern,
            subscription: subscriptionName,
        });
    }
    /**
    * Create a map of all the listeners that patterns match the subscriptionName locally
    */
    createRemoteListenArray(subscriptionName) {
        const patterns = this.patterns;
        const providerRegistry = this.providerRegistry;
        let servers = [];
        const providerPatterns = providerRegistry.getNames();
        for (let i = 0; i < providerPatterns.length; i++) {
            const pattern = providerPatterns[i];
            let p = this.patterns[pattern];
            if (p == null) {
                this.services.logger.warn(constants_1.EVENT.INFO, `can't handle pattern ${pattern}`, this.metaData);
                this.addPattern(pattern);
                p = this.patterns[pattern];
            }
            if (p.test(subscriptionName)) {
                servers = servers.concat(providerRegistry.getAllServers(pattern));
            }
        }
        const set = new Set(servers);
        set.delete(this.config.serverName);
        if (!this.config.shuffleListenProviders) {
            return Array.from(set);
        }
        return utils_1.shuffleArray(Array.from(set));
    }
    /**
    * Create a map of all the listeners that patterns match the subscriptionName locally
    */
    createLocalListenArray(subscriptionName) {
        const patterns = this.patterns;
        const providerRegistry = this.providerRegistry;
        const providers = [];
        for (const pattern in patterns) {
            if (patterns[pattern].test(subscriptionName)) {
                for (const socketWrapper of providerRegistry.getLocalSubscribers(pattern)) {
                    providers.push({ pattern, socketWrapper });
                }
            }
        }
        if (!this.config.shuffleListenProviders) {
            return providers;
        }
        return utils_1.shuffleArray(providers);
    }
    /**
    * Validates that the pattern is not empty and is a valid regular expression
    */
    validatePattern(socketWrapper, message) {
        try {
            return new RegExp(message.name);
        }
        catch (e) {
            socketWrapper.sendError({ topic: this.topic }, this.actions.INVALID_LISTEN_REGEX);
            this.services.logger.error(this.actions[this.actions.INVALID_LISTEN_REGEX], e.toString(), this.metaData);
            return null;
        }
    }
    /**
  * Returns the unique lock when leading a listen discovery phase
  */
    getUniqueLockName(subscriptionName) {
        return `${this.uniqueLockName}_${subscriptionName}`;
    }
}
exports.default = ListenerRegistry;
//# sourceMappingURL=listener-registry.js.map