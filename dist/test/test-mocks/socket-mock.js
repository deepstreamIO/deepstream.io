"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class SocketMock extends events_1.EventEmitter {
    constructor() {
        super();
        this.lastSendMessage = null;
        this.isDisconnected = false;
        this.sendMessages = [];
        this.autoClose = true;
        this.readyState = '';
        this.socket = {};
        this.ssl = null;
        this._handle = {};
    }
    send(message) {
        this.lastSendMessage = message;
        this.sendMessages.push(message);
    }
    end() {
    }
    getMsg(i) {
        return this.sendMessages[this.sendMessages.length - (i + 1)];
    }
    getMsgSize() {
        return this.sendMessages.length;
    }
    close() {
        if (this.autoClose === true) {
            this.doClose();
        }
    }
    destroy() {
        this.doClose();
    }
    doClose() {
        this.isDisconnected = true;
        this.readyState = 'closed';
        this.emit('close');
    }
    setNoDelay() {
    }
}
exports.default = SocketMock;
//# sourceMappingURL=socket-mock.js.map