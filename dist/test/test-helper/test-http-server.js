"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const events_1 = require("events");
class TestHttpServer extends events_1.EventEmitter {
    constructor(port, callback, doLog = false) {
        super();
        this.server = http.createServer(this._onRequest.bind(this));
        this.lastRequestData = null;
        this.hasReceivedRequest = false;
        this.lastRequestHeaders = null;
        this.port = port;
        this.callback = callback;
        this.doLog = doLog;
        this.response = null;
        this.server.listen(port, this._onListen.bind(this));
    }
    static getRandomPort() {
        return 1000 + Math.floor(Math.random() * 9000);
    }
    reset() {
        this.lastRequestData = null;
        this.hasReceivedRequest = false;
        this.lastRequestHeaders = null;
    }
    respondWith(statusCode, data) {
        if (typeof data === 'object') {
            data = JSON.stringify(data); // eslint-disable-line
        }
        this.response.setHeader('content-type', 'application/json');
        this.response.writeHead(statusCode);
        this.response.end(data);
    }
    close(callback) {
        this.server.close(callback);
    }
    _onListen() {
        this._log.bind(this, `server listening on port ${this.port}`);
        this.callback();
    }
    _log(msg) {
        if (this.doLog) {
            console.log(msg);
        }
    }
    _onRequest(request, response) {
        request.postData = '';
        request.setEncoding('utf8');
        request.on('data', this._addChunk.bind(this, request));
        request.on('end', this._onRequestComplete.bind(this, request));
        this.response = response;
    }
    _addChunk(request, chunk) {
        request.postData += chunk;
    }
    _onRequestComplete(request) {
        this.lastRequestData = JSON.parse(request.postData);
        this.lastRequestHeaders = request.headers;
        this.lastRequestMethod = request.method;
        this.emit('request-received');
        this._log(`received data ${request.postData}`);
    }
}
exports.default = TestHttpServer;
//# sourceMappingURL=test-http-server.js.map