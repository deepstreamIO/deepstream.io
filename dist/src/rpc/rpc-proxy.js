"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const constants_1 = require("../constants");
/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky.
 */
class RpcProxy extends events_1.EventEmitter {
    /**
    */
    constructor(config, services, remoteServer, metaData) {
        super();
        this.isRemote = true;
        this.metaData = metaData;
        this.config = config;
        this.services = services;
        this.remoteServer = remoteServer;
        // used for logging
        this.user = 'remote server ' + remoteServer;
    }
    sendAckMessage(message) {
    }
    /**
    * Mimicks the SocketWrapper's send method, but expects a message object,
    * instead of a string.
    *
    * Adds additional information to the message that enables the counterparty
    * to identify the sender
    */
    sendMessage(msg) {
        this.services.message.sendDirect(this.remoteServer, msg, this.metaData);
    }
    /**
    * Mimicks the SocketWrapper's sendError method.
    * Sends an error on the specified topic. The
    * action will automatically be set to ACTION.ERROR
    */
    sendError(msg, type, errorMessage) {
        if (type === constants_1.RPC_ACTIONS.RESPONSE_TIMEOUT) {
            // by the time an RPC has timed out on this server, it has already timed out on the remote
            // (and has been cleaned up) so no point sending
            return;
        }
        this.services.message.sendDirect(this.remoteServer, msg, this.metaData);
    }
}
exports.default = RpcProxy;
//# sourceMappingURL=rpc-proxy.js.map