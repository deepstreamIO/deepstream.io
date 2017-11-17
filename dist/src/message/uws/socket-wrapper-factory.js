"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../constants");
const messageBuilder = require("../../../protocol/text/src/message-builder");
const messageParser = require("../../../protocol/text/src/message-parser");
const uws = require("uws");
const events_1 = require("events");
/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 *
 * @param {WebSocket} external        uws native websocket
 * @param {Object} handshakeData      headers from the websocket http handshake
 * @param {Logger} logger
 * @param {Object} config             configuration options
 * @param {Object} connectionEndpoint the uws connection endpoint
 *
 * @extends EventEmitter
 *
 * @constructor
 */
class UwsSocketWrapper extends events_1.EventEmitter {
    constructor(external, handshakeData, logger, config, connectionEndpoint) {
        super();
        this.external = external;
        this.handshakeData = handshakeData;
        this.logger = logger;
        this.config = config;
        this.connectionEndpoint = connectionEndpoint;
        this.isClosed = false;
        this.uuid = Math.random();
        this.authAttempts = 0;
        this.bufferedWrites = '';
        this.setMaxListeners(0);
    }
    /**
     * Updates lastPreparedMessage and returns the [uws] prepared message.
     */
    prepareMessage(message) {
        UwsSocketWrapper.lastPreparedMessage = uws.native.server.prepareMessage(message, uws.OPCODE_TEXT);
        return UwsSocketWrapper.lastPreparedMessage;
    }
    /**
     * Sends the [uws] prepared message, or in case of testing sends the
     * last prepared message.
     */
    sendPrepared(preparedMessage) {
        this.flush();
        uws.native.server.sendPrepared(this.external, preparedMessage);
    }
    /**
     * Finalizes the [uws] prepared message.
     */
    finalizeMessage(preparedMessage) {
        uws.native.server.finalizeMessage(preparedMessage);
    }
    /**
     * Variant of send with no particular checks or appends of message.
     */
    sendNative(message, allowBuffering) {
        if (this.config.outgoingBufferTimeout === 0) {
            uws.native.server.send(this.external, message, uws.OPCODE_TEXT);
        }
        else if (!allowBuffering) {
            this.flush();
            uws.native.server.send(this.external, message, uws.OPCODE_TEXT);
        }
        else {
            this.bufferedWrites += message;
            if (this.connectionEndpoint.scheduleFlush) {
                this.connectionEndpoint.scheduleFlush(this);
            }
        }
    }
    /**
     * Called by the connection endpoint to flush all buffered writes.
     * A buffered write is a write that is not a high priority, such as an ack
     * and can wait to be bundled into another message if necessary
     */
    flush() {
        if (this.bufferedWrites !== '') {
            uws.native.server.send(this.external, this.bufferedWrites, uws.OPCODE_TEXT);
            this.bufferedWrites = '';
        }
    }
    /**
     * Sends an error on the specified topic. The
     * action will automatically be set to C.ACTION.ERROR
     */
    sendError(message, action, errorMessage, allowBuffering) {
        if (this.isClosed === false) {
            this.sendNative(messageBuilder.getErrorMessage(message, action, errorMessage), allowBuffering);
        }
    }
    /**
     * Sends a message based on the provided action and topic
     * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
     *                                 this message type
     */
    sendMessage(message, allowBuffering) {
        if (this.isClosed === false) {
            this.sendNative(messageBuilder.getMessage(message, false), allowBuffering);
        }
    }
    getMessage(message) {
        return messageBuilder.getMessage(message, false);
    }
    parseMessage(message) {
        return messageParser.parse(message);
    }
    /**
     * Sends a message based on the provided action and topic
     * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
     *                                 this message type
     */
    sendAckMessage(message, allowBuffering) {
        if (this.isClosed === false) {
            this.sendNative(messageBuilder.getMessage(message, true), allowBuffering);
        }
    }
    parseData(message) {
        return messageParser.parseData(message);
    }
    onMessage() {
    }
    /**
     * Destroys the socket. Removes all deepstream specific
     * logic and closes the connection
     */
    destroy() {
        uws.native.server.terminate(this.external);
    }
    close() {
        this.isClosed = true;
        delete this.authCallback;
        this.emit('close', this);
        this.logger.info(constants_1.EVENT.CLIENT_DISCONNECTED, this.user);
        this.removeAllListeners();
    }
    /**
     * Returns a map of parameters that were collected
     * during the initial http request that established the
     * connection
     */
    getHandshakeData() {
        return this.handshakeData;
    }
}
UwsSocketWrapper.lastPreparedMessage = null;
function createSocketWrapper(external, handshakeData, logger, config, connectionEndpoint) { return new UwsSocketWrapper(external, handshakeData, logger, config, connectionEndpoint); }
exports.createSocketWrapper = createSocketWrapper;
//# sourceMappingURL=socket-wrapper-factory.js.map