"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const SocketWrapperMock = class extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.isClosed = false;
        this.user = null;
        this.authCallBack = null;
        this.authAttempts = 0;
        this.uuid = Math.random();
        this.handshakeData = options;
    }
    prepareMessage(message) {
        SocketWrapperMock.lastPreparedMessage = message;
        return message;
    }
    sendPrepared() {
    }
    finalizeMessage() {
    }
    sendNative(message) {
        this.lastSendMessage = message;
    }
    sendAckMessage(message) {
        this.lastSendMessage = message;
    }
    getHandshakeData() {
        return this.handshakeData;
    }
    sendError() {
    }
    sendMessage(message) {
        this.lastSendMessage = message;
    }
    parseData(message) {
        if (message.parsedData || !message.data) {
            return null;
        }
        try {
            message.parsedData = JSON.parse(message.data);
            return true;
        }
        catch (e) {
            return e;
        }
    }
    send() {
    }
    destroy() {
        this.authCallBack = null;
        this.isClosed = true;
        this.emit('close', this);
    }
    close() {
        this.destroy();
    }
    setUpHandshakeData() {
        this.handshakeData = {
            remoteAddress: 'remote@address'
        };
        return this.handshakeData;
    }
};
exports.createSocketWrapper = (options) => new SocketWrapperMock(options);
//# sourceMappingURL=socket-wrapper-factory-mock.js.map