"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Group {
    constructor(root) {
        this.root = root;
    }
    startAutoPing(group, interval, message) {
        this.root.heartbeatInterval = interval;
        this.root.pingMessage = message;
    }
    create() {
        return {};
    }
    onConnection(group, connectionHandler) {
        this.root._connectionHandler = connectionHandler;
    }
    onDisconnection(group, disconnectionHandler) {
    }
    onMessage(group, messageHandler) {
        this.root.messageHandler = messageHandler;
    }
    onPing(group, pingHandler) {
    }
    onPong(group, pongHandler) {
    }
    broadcast() {
    }
    close() {
    }
}
exports.Group = Group;
// tslint:disable-next-line:max-classes-per-file
class Server {
    constructor(root) {
        this.root = root;
        this.group = new Group(root);
    }
    send() {
    }
}
exports.Server = Server;
// tslint:disable-next-line:max-classes-per-file
class Native {
    constructor(root) {
        this.root = root;
        this.server = new Server(root);
        this.root._lastUserData = null;
    }
    setUserData(external, userData) {
        this.root._lastUserData = userData;
    }
    clearUserData() {
    }
    getAddress() {
        return [null, '127.0.0.1', null];
    }
    transfer() {
        this.root.close();
    }
    upgrade() {
        const external = {};
        this.root._connectionHandler(external);
    }
}
exports.Native = Native;
let i = 0;
let uwsMock = null;
const events_1 = require("events");
// tslint:disable-next-line:max-classes-per-file
class UWSMock extends events_1.EventEmitter {
    constructor() {
        super();
        this.clients = {};
        this.clientsCount = 0;
        this.heartbeatInterval = null;
        this.pingMessage = null;
        this.connectionHandler = null;
        this.messageHandler = null;
        this.setMaxListeners(0);
        uwsMock = this;
        this.native = new Native(this);
    }
    simulateConnection() {
        const socketMock = this.lastUserData;
        const clientIndex = i++;
        socketMock.once('close', this._onClose.bind(this, clientIndex));
        this.clients[clientIndex] = socketMock;
        this.clientsCount++;
        return socketMock;
    }
    _onClose(clientIndex) {
        delete this.clients[clientIndex];
        this.clientsCount--;
    }
    close() {
    }
}
exports.UWSMock = UWSMock;
exports.default = new UWSMock();
//# sourceMappingURL=uws-mock.js.map