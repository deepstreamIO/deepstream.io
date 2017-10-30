'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable class-methods-use-this */
const events_1 = require("events");
const messageParser = require("../../../protocol/text/src/message-parser");
class HTTPSocketWrapper extends events_1.EventEmitter {
    constructor(options, onMessage, onError) {
        super();
        this.uuid = Math.random();
        this.isClosed = false;
        this._onMessage = onMessage;
        this._onError = onError;
    }
    init(authResponseData, messageIndex, messageResults, responseCallback, requestTimeoutId) {
        this.user = authResponseData.userId || authResponseData.username || 'OPEN';
        this.authData = authResponseData.serverData;
        this._correlationIndex = messageIndex;
        this._messageResults = messageResults;
        this._responseCallback = responseCallback;
        this._requestTimeout = requestTimeoutId;
    }
    close() {
        this.isClosed = true;
    }
    prepareMessage() {
    }
    sendPrepared() {
    }
    sendNative() {
    }
    finalizeMessage() {
    }
    flush() {
    }
    onMessage() {
    }
    /**
     * Returns a map of parameters that were collected
     * during the initial http request that established the
     * connection
     *
     * @public
     * @returns {Object} handshakeData
     */
    getHandshakeData() {
        return {};
    }
    /**
     * Sends an error on the specified topic. The
     * action will automatically be set to C.ACTION.ERROR
     *
     * @param {String} topic one of C.TOPIC
     * @param {String} event one of C.EVENT
     * @param {String} msg generic error message
     *
     * @public
     * @returns {void}
     */
    sendError(message, event, errorMessage) {
        if (this.isClosed === false) {
            messageParser.parseData(message);
            this._onError(this._messageResults, this._correlationIndex, message, event, errorMessage, this._responseCallback, this._requestTimeout);
        }
    }
    /**
     * Sends a message based on the provided action and topic
     *
     * @param {Object} message
     *
     * @public
     * @returns {void}
     */
    sendMessage(message) {
        if (this.isClosed === false) {
            messageParser.parseData(message);
            this._onMessage(this._messageResults, this._correlationIndex, message, this._responseCallback, this._requestTimeout);
        }
    }
    sendAckMessage(message) {
        message.isAck = true;
        this.sendMessage(message);
    }
    parseData(message) {
        return messageParser.parseData(message);
    }
    /**
     * Destroyes the socket. Removes all deepstream specific
     * logic and closes the connection
     *
     * @public
     * @returns {void}
     */
    destroy() {
    }
}
exports.default = HTTPSocketWrapper;
//# sourceMappingURL=socket-wrapper.js.map