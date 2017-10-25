"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const listener_registry_1 = require("../listen/listener-registry");
const subscription_registry_1 = require("../utils/subscription-registry");
class EventHandler {
    /**
     * Handles incoming and outgoing messages for the EVENT topic.
     */
    constructor(config, services, subscriptionRegistry, listenerRegistry) {
        this.config = config;
        this.subscriptionRegistry =
            subscriptionRegistry || new subscription_registry_1.default(config, services, constants_1.TOPIC.EVENT, constants_1.TOPIC.EVENT_SUBSCRIPTIONS);
        this.listenerRegistry =
            listenerRegistry || new listener_registry_1.default(constants_1.TOPIC.EVENT, config, services, this.subscriptionRegistry, null);
        this.subscriptionRegistry.setSubscriptionListener(this.listenerRegistry);
        this.logger = services.logger;
    }
    /**
     * The main distribution method. Routes messages to functions
     * based on the provided action parameter of the message
     */
    handle(socket, message) {
        if (message.action === constants_1.EVENT_ACTIONS.SUBSCRIBE) {
            this.subscriptionRegistry.subscribe(message, socket);
        }
        else if (message.action === constants_1.EVENT_ACTIONS.UNSUBSCRIBE) {
            this.subscriptionRegistry.unsubscribe(message, socket);
        }
        else if (message.action === constants_1.EVENT_ACTIONS.EMIT) {
            this.triggerEvent(socket, message);
        }
        else if (message.action === constants_1.EVENT_ACTIONS.LISTEN ||
            message.action === constants_1.EVENT_ACTIONS.UNLISTEN ||
            message.action === constants_1.EVENT_ACTIONS.LISTEN_ACCEPT ||
            message.action === constants_1.EVENT_ACTIONS.LISTEN_REJECT) {
            this.listenerRegistry.handle(socket, message);
        }
        else {
            console.log('unknown action', message);
        }
    }
    /**
     * Notifies subscribers of events. This method is invoked for the EVENT action. It can
     * be triggered by messages coming in from both clients and the message connector.
     */
    triggerEvent(socket, message) {
        this.logger.debug(constants_1.EVENT_ACTIONS[constants_1.EVENT_ACTIONS.EMIT], `event: ${message.name} with data: ${message.data}`);
        this.subscriptionRegistry.sendToSubscribers(message.name, message, false, socket);
    }
}
exports.default = EventHandler;
//# sourceMappingURL=event-handler.js.map