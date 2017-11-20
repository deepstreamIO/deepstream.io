"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
/**
 * The MessageDistributor routes valid and permissioned messages to
 * various, previously registered handlers, e.g. event-, rpc- or recordHandler
 */
class MessageDistributor {
    constructor(options, services) {
        this.callbacks = {};
        this.options = options;
        this.services = services;
    }
    /**
     * Accepts a socketWrapper and a parsed message as input and distributes
     * it to its subscriber, based on the message's topic
     */
    distribute(socketWrapper, message) {
        if (this.callbacks[message.topic] === undefined) {
            this.services.logger.warn(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.UNKNOWN_TOPIC], constants_1.TOPIC[message.topic]);
            socketWrapper.sendMessage({
                topic: constants_1.TOPIC.PARSER,
                action: constants_1.PARSER_ACTIONS.UNKNOWN_TOPIC,
                originalTopic: message.topic
            });
            return;
        }
        // TODO: Can we remove this? A general emit is quite expensive
        // socketWrapper.emit(message.topic, message)
        this.callbacks[message.topic](socketWrapper, message);
    }
    /**
     * Allows handlers (event, rpc, record) to register for topics. Subscribes them
     * to both messages passed to the distribute method as well as messages received
     * from the messageConnector
     */
    registerForTopic(topic, callback) {
        if (this.callbacks[topic] !== undefined) {
            throw new Error(`Callback already registered for topic ${topic}`);
        }
        this.callbacks[topic] = callback;
        this.services.message.subscribe(topic, this.onMessageConnectorMessage.bind(this, callback));
    }
    /**
     * Whenever a message from the messageConnector is received it is passed
     * to the relevant handler, but with SOURCE_MESSAGE_CONNECTOR instead of
     * a socketWrapper as sender
     */
    onMessageConnectorMessage(callback, message, originServer) {
        // callback(SOURCE_MESSAGE_CONNECTOR, message, originServer)
    }
}
exports.default = MessageDistributor;
//# sourceMappingURL=message-distributor.js.map