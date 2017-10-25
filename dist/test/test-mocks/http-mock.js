"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const util = require('util');
class HttpServerMock extends events_1.EventEmitter {
    constructor() {
        super();
        this.listening = false;
        this.closed = false;
    }
    listen(port, host, callback) {
        this.port = port;
        this.host = host;
        const server = this;
        process.nextTick(() => {
            server.listening = true;
            server.emit('listening');
            if (callback) {
                callback();
            }
        });
    }
    close(callback) {
        this.closed = true;
        this.emit('close');
        if (callback) {
            callback();
        }
    }
    address() {
        return {
            address: this.host,
            port: this.port
        };
    }
    _simulateUpgrade(socket) {
        const head = {};
        const request = {
            url: 'https://deepstream.io/?ds=foo',
            headers: {
                'origin': '',
                'sec-websocket-key': 'xxxxxxxxxxxxxxxxxxxxxxxx'
            },
            connection: {
                authorized: true
            }
        };
        this.emit('upgrade', request, socket, head);
    }
}
exports.HttpServerMock = HttpServerMock;
// tslint:disable-next-line:max-classes-per-file
class HttpMock {
    constructor() {
        this.nextServerIsListening = false;
    }
    createServer() {
        const server = new HttpServerMock();
        server.listening = this.nextServerIsListening;
        return server;
    }
}
exports.default = HttpMock;
//# sourceMappingURL=http-mock.js.map