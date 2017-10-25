"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
/**
 * Relays a remote procedure call from a requestor to a provider and routes
 * the providers response to the requestor. Provider might either be a locally
 * connected SocketWrapper or a RpcProviderProxy that forwards messages
 * from a remote provider within the network
 */
class Rpc {
    /**
    */
    constructor(rpcHandler, requestor, provider, config, services, message) {
        this.rpcHandler = rpcHandler;
        this.rpcName = message.name;
        this.correlationId = message.correlationId;
        this.requestor = requestor;
        this.provider = provider;
        this.config = config;
        this.services = services;
        this.message = message;
        this.isAccepted = false;
        this.setProvider(provider);
    }
    /**
    * Processor for incoming messages from the RPC provider. The
    * RPC provider is expected to send two messages,
    *
    * RPC|A|REQ|<rpcName>|<correlationId>
    *
    * and
    *
    * RPC|RES|<rpcName>|<correlationId|[<data>]
    *
    * Both of these messages will just be forwarded directly
    * to the requestor
    */
    handle(message) {
        if (message.correlationId !== this.correlationId) {
            return;
        }
        if (message.action === constants_1.RPC_ACTIONS.ACCEPT) {
            this.handleAccept(message);
        }
        else if (message.action === constants_1.RPC_ACTIONS.REJECT) {
            this.reroute();
        }
        else if (message.action === constants_1.RPC_ACTIONS.RESPONSE || message.action === constants_1.RPC_ACTIONS.ERROR) {
            this.requestor.sendMessage(message);
            this.destroy();
        }
    }
    /**
    * Destroyes this Rpc, either because its completed
    * or because a timeout has occured
    */
    destroy() {
        clearTimeout(this.acceptTimeout);
        clearTimeout(this.responseTimeout);
        this.rpcHandler.onRPCDestroyed(this.correlationId);
    }
    /**
    * By default, a RPC is the communication between one requestor
    * and one provider. If the original provider however rejects
    * the request, deepstream will try to re-route it to another provider.
    *
    * This happens in the reroute method. This method will query
    * the rpc-handler for an alternative provider and - if it has
    * found one - call this method to replace the provider and re-do
    * the second leg of the rpc
    */
    setProvider(provider) {
        clearTimeout(this.acceptTimeout);
        clearTimeout(this.responseTimeout);
        this.provider = provider;
        this.acceptTimeout = setTimeout(this.onAcceptTimeout.bind(this), this.config.rpcAckTimeout);
        this.responseTimeout = setTimeout(this.onResponseTimeout.bind(this), this.config.rpcTimeout);
        this.provider.sendMessage(this.message);
    }
    /**
    * Handles rpc acknowledgement messages from the provider.
    * If more than one Ack is received an error will be returned
    * to the provider
    */
    handleAccept(message) {
        if (this.isAccepted === true) {
            this.provider.sendError(this.message, constants_1.RPC_ACTIONS.MULTIPLE_ACCEPT);
            return;
        }
        clearTimeout(this.acceptTimeout);
        this.isAccepted = true;
        this.requestor.sendMessage(message);
    }
    /**
    * This method handles rejection messages from the current provider. If
    * a provider is temporarily unable to serve a request, it can reject it
    * and deepstream will try to reroute to an alternative provider
    *
    * If no alternative provider could be found, this method will send a NO_RPC_PROVIDER
    * error to the client and destroy itself
    */
    reroute() {
        const alternativeProvider = this.rpcHandler.getAlternativeProvider(this.rpcName, this.correlationId);
        if (alternativeProvider) {
            this.setProvider(alternativeProvider);
        }
        else {
            this.requestor.sendError(this.message, constants_1.RPC_ACTIONS.NO_RPC_PROVIDER);
            this.destroy();
        }
    }
    /**
    * Callback if the accept message hasn't been returned
    * in time by the provider
    */
    onAcceptTimeout() {
        this.requestor.sendError(this.message, constants_1.RPC_ACTIONS.ACCEPT_TIMEOUT);
        this.destroy();
    }
    /**
    * Callback if the response message hasn't been returned
    * in time by the provider
    */
    onResponseTimeout() {
        this.requestor.sendError(this.message, constants_1.RPC_ACTIONS.RESPONSE_TIMEOUT);
        this.destroy();
    }
}
exports.default = Rpc;
//# sourceMappingURL=rpc.js.map