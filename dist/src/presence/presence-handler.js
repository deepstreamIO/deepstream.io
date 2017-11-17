"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const subscription_registry_1 = require("../utils/subscription-registry");
const EVERYONE = '%_EVERYONE_%';
function parseUserNames(names) {
    // Returns all users for backwards compatability
    if (names === 'S') {
        return [EVERYONE];
    }
    try {
        return JSON.parse(names);
    }
    catch (e) {
        return null;
    }
}
/**
 * This class handles incoming and outgoing messages in relation
 * to deepstream presence. It provides a way to inform clients
 * who else is logged into deepstream
 */
class PresenceHandler {
    constructor(config, services, subscriptionRegistry, stateRegistry, metaData) {
        this.metaData = metaData;
        this.config = config;
        this.services = services;
        this.localClients = new Map();
        this.subscriptionRegistry =
            subscriptionRegistry || new subscription_registry_1.default(config, services, constants_1.TOPIC.PRESENCE, constants_1.TOPIC.PRESENCE_SUBSCRIPTIONS);
        this.connectedClients =
            stateRegistry || this.services.message.getStateRegistry(constants_1.TOPIC.ONLINE_USERS);
        this.connectedClients.on('add', this.onClientAdded.bind(this));
        this.connectedClients.on('remove', this.onClientRemoved.bind(this));
    }
    /**
    * The main entry point to the presence handler class.
    *
    * Handles subscriptions, unsubscriptions and queries
    */
    handle(socketWrapper, message) {
        if (message.action === constants_1.PRESENCE_ACTIONS.QUERY_ALL) {
            this.handleQueryAll(message.correlationId, socketWrapper);
            return;
        }
        const users = parseUserNames(message.data);
        if (!users) {
            this.services.logger.error(constants_1.PRESENCE_ACTIONS[constants_1.PRESENCE_ACTIONS.INVALID_PRESENCE_USERS], message.data, this.metaData);
            socketWrapper.sendError(message, constants_1.PRESENCE_ACTIONS.INVALID_PRESENCE_USERS);
            return;
        }
        if (message.action === constants_1.PRESENCE_ACTIONS.SUBSCRIBE) {
            for (let i = 0; i < users.length; i++) {
                this.subscriptionRegistry.subscribe({
                    topic: constants_1.TOPIC.PRESENCE,
                    action: constants_1.PRESENCE_ACTIONS.SUBSCRIBE,
                    name: users[i],
                }, socketWrapper);
            }
        }
        else if (message.action === constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE) {
            for (let i = 0; i < users.length; i++) {
                this.subscriptionRegistry.unsubscribe({
                    topic: constants_1.TOPIC.PRESENCE,
                    action: constants_1.PRESENCE_ACTIONS.UNSUBSCRIBE,
                    name: users[i],
                }, socketWrapper);
            }
        }
        else if (message.action === constants_1.PRESENCE_ACTIONS.QUERY) {
            this.handleQuery(users, message.correlationId, socketWrapper);
        }
        else {
            this.services.logger.warn(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.UNKNOWN_ACTION], constants_1.PRESENCE_ACTIONS[message.action], this.metaData);
        }
    }
    /**
    * Called whenever a client has succesfully logged in with a username
    */
    handleJoin(socketWrapper) {
        const currentCount = this.localClients.get(socketWrapper.user);
        if (currentCount === undefined) {
            this.localClients.set(socketWrapper.user, 1);
            this.connectedClients.add(socketWrapper.user);
        }
        else {
            this.localClients.set(socketWrapper.user, currentCount + 1);
        }
    }
    /**
    * Called whenever a client has disconnected
    */
    handleLeave(socketWrapper) {
        const currentCount = this.localClients.get(socketWrapper.user);
        if (!currentCount) {
            // TODO: Log Error
        }
        else if (currentCount === 1) {
            this.localClients.delete(socketWrapper.user);
            this.connectedClients.remove(socketWrapper.user);
        }
        else {
            this.localClients.set(socketWrapper.user, currentCount - 1);
        }
    }
    handleQueryAll(correlationId, socketWrapper) {
        const clients = this.connectedClients.getAll();
        const index = clients.indexOf(socketWrapper.user);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        socketWrapper.sendMessage({
            topic: constants_1.TOPIC.PRESENCE,
            action: constants_1.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE,
            parsedData: clients,
        });
    }
    /**
    * Handles finding clients who are connected and splicing out the client
    * querying for users
    */
    handleQuery(users, correlationId, socketWrapper) {
        const result = {};
        const clients = this.connectedClients.getAllMap();
        for (let i = 0; i < users.length; i++) {
            result[users[i]] = !!clients[users[i]];
        }
        socketWrapper.sendMessage({
            topic: constants_1.TOPIC.PRESENCE,
            action: constants_1.PRESENCE_ACTIONS.QUERY_RESPONSE,
            correlationId,
            parsedData: result,
        });
    }
    /**
    * Alerts all clients who are subscribed to
    * PRESENCE_JOIN that a new client has been added.
    */
    onClientAdded(username) {
        const message = {
            topic: constants_1.TOPIC.PRESENCE,
            action: constants_1.PRESENCE_ACTIONS.PRESENCE_JOIN,
            name: username,
        };
        this.subscriptionRegistry.sendToSubscribers(EVERYONE, message, false, null, false);
        this.subscriptionRegistry.sendToSubscribers(username, message, false, null, false);
    }
    /**
    * Alerts all clients who are subscribed to
    * PRESENCE_LEAVE that the client has left.
    */
    onClientRemoved(username) {
        const message = {
            topic: constants_1.TOPIC.PRESENCE,
            action: constants_1.PRESENCE_ACTIONS.PRESENCE_LEAVE,
            name: username,
        };
        this.subscriptionRegistry.sendToSubscribers(EVERYONE, message, false, null, false);
        this.subscriptionRegistry.sendToSubscribers(username, message, false, null, false);
    }
}
exports.default = PresenceHandler;
//# sourceMappingURL=presence-handler.js.map