"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const StateRegistry = require('../../src/cluster/state-registry').default;
class MessageConnectorMock extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.lastPublishedTopic = null;
        this.lastPublishedMessage = null;
        this.lastSubscribedTopic = null;
        this.publishedMessages = [];
        this.eventEmitter = new events_1.EventEmitter();
        this.eventEmitter.setMaxListeners(0);
        this.all = null;
        this.currentLeader = null;
        this.options = options;
    }
    reset() {
        this.publishedMessages = [];
        this.lastPublishedTopic = null;
        this.lastPublishedMessage = null;
        this.lastSubscribedTopic = null;
        this.all = ['server-name-a', 'server-name-b', 'server-name-c'];
        this.currentLeader = 'server-name-a';
    }
    subscribe(topic, callback) {
        this.lastSubscribedTopic = topic;
        this.eventEmitter.on(topic, callback);
    }
    sendBroadcast() {
    }
    send(message) {
        this.publishedMessages.push(message);
        this.lastPublishedTopic = message.topic;
        this.lastPublishedMessage = JSON.parse(JSON.stringify(message));
    }
    sendState(topic, message) {
    }
    sendDirect(serverName, message) {
        this.lastDirectSentMessage = {
            serverName,
            message
        };
    }
    unsubscribe(topic, callback) {
        this.eventEmitter.removeListener(topic, callback);
    }
    simulateIncomingMessage(topic, msg, serverName) {
        this.eventEmitter.emit(topic, msg, serverName);
    }
    getAll() {
        return this.all;
    }
    isLeader() {
        return this.currentLeader === this.options.serverName;
    }
    getCurrentLeader() {
        return this.currentLeader;
    }
    subscribeServerDisconnect() {
    }
    getStateRegistry(topic) {
        return new StateRegistry(topic, this.options, this);
    }
}
exports.default = MessageConnectorMock;
//# sourceMappingURL=message-connector-mock.js.map