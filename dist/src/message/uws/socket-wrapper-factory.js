"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../constants");
const binaryMessageBuilder = require("../../../protocol/binary/src/message-builder");
const binaryMessageParser = require("../../../protocol/binary/src/message-parser");
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
        UwsSocketWrapper.lastPreparedMessage = uws.native.server.prepareMessage(message, uws.OPCODE_BINARY);
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
        uws.native.server.send(this.external, message, uws.OPCODE_BINARY);
        /*
         *if (this.config.outgoingBufferTimeout === 0) {
         *  uws.native.server.send(this.external, message, uws.OPCODE_TEXT)
         *} else if (!allowBuffering) {
         *  this.flush()
         *  uws.native.server.send(this.external, message, uws.OPCODE_TEXT)
         *} else {
         *  this.bufferedWrites += message
         *  if (this.connectionEndpoint.scheduleFlush) {
         *    this.connectionEndpoint.scheduleFlush(this)
         *  }
         *}
         */
    }
    /**
     * Called by the connection endpoint to flush all buffered writes.
     * A buffered write is a write that is not a high priority, such as an ack
     * and can wait to be bundled into another message if necessary
     */
    flush() {
        if (this.bufferedWrites !== '') {
            uws.native.server.send(this.external, this.bufferedWrites, uws.OPCODE_BINARY);
            this.bufferedWrites = '';
        }
    }
    /**
     * Sends a message based on the provided action and topic
     * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
     *                                 this message type
     */
    sendMessage(message, allowBuffering) {
        if (this.isClosed === false) {
            this.sendNative(binaryMessageBuilder.getMessage(message, false), allowBuffering);
        }
    }
    getMessage(message) {
        return binaryMessageBuilder.getMessage(message, false);
    }
    parseMessage(message) {
        let messageBuffer;
        if (message instanceof ArrayBuffer) {
            /* we copy the underlying buffer (since a shallow reference won't be safe
             * outside of the callback)
             * the copy could be avoided if we make sure not to store references to the
             * raw buffer within the message
             */
            messageBuffer = Buffer.from(Buffer.from(message));
        }
        else {
            // return textMessageParser.parse(message)
            console.error('received string message', message);
            return [];
        }
        return binaryMessageParser.parse(messageBuffer);
    }
    /**
     * Sends a message based on the provided action and topic
     * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
     *                                 this message type
     */
    sendAckMessage(message, allowBuffering) {
        if (this.isClosed === false) {
            this.sendNative(binaryMessageBuilder.getMessage(message, true), allowBuffering);
        }
    }
    parseData(message) {
        return binaryMessageParser.parseData(message);
    }
    onMessage(messages) {
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
exports.UwsSocketWrapper = UwsSocketWrapper;
UwsSocketWrapper.lastPreparedMessage = null;
function createSocketWrapper(external, handshakeData, logger, config, connectionEndpoint) { return new UwsSocketWrapper(external, handshakeData, logger, config, connectionEndpoint); }
exports.createSocketWrapper = createSocketWrapper;
//# sourceMappingURL=socket-wrapper-factory.js.map