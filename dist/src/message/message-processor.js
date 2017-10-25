"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
/**
 * The MessageProcessor consumes blocks of parsed messages emitted by the
 * ConnectionEndpoint, checks if they are permissioned and - if they
 * are - forwards them.
 */
class MessageProcessor {
    constructor(config, services) {
        this.config = config;
        this.services = services;
    }
    /**
     * There will only ever be one consumer of forwarded messages. So rather than using
     * events - and their performance overhead - the messageProcessor exposes
     * this method that's expected to be overwritten.
     */
    onAuthenticatedMessage(socketWrapper, message) {
    }
    /**
     * This method is the way the message processor accepts input. It receives arrays
     * of parsed messages, iterates through them and issues permission requests for
     * each individual message
     *
     * @todo The responses from the permissionHandler might arive in any arbitrary order - order them
     * @todo Handle permission handler timeouts
     */
    process(socketWrapper, parsedMessages) {
        let message;
        const length = parsedMessages.length;
        for (let i = 0; i < length; i++) {
            message = parsedMessages[i];
            if (message === null ||
                !message.action ||
                !message.topic) {
                this.services.logger.warn(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR], message);
                socketWrapper.sendError({
                    topic: constants_1.TOPIC.ERROR,
                }, constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR, message);
                continue;
            }
            this.services.permissionHandler.canPerformAction(socketWrapper.user, message, this.onPermissionResponse.bind(this, socketWrapper, message), socketWrapper.authData, socketWrapper);
        }
    }
    /**
     * Processes the response that's returned by the permissionHandler.
     *
     * @param   {SocketWrapper}   socketWrapper
     * @param   {Object} message  parsed message - might have been manipulated
     *                              by the permissionHandler
     * @param   {Error} error     error or null if no error. Denied permissions will be expressed
     *                            by setting result to false
     * @param   {Boolean} result    true if permissioned
     */
    onPermissionResponse(socketWrapper, message, error, result) {
        if (error !== null) {
            this.services.logger.warn(constants_1.AUTH_ACTIONS[constants_1.AUTH_ACTIONS.MESSAGE_PERMISSION_ERROR], error.toString());
            socketWrapper.sendError(message, constants_1.AUTH_ACTIONS.MESSAGE_PERMISSION_ERROR);
            return;
        }
        if (result !== true) {
            socketWrapper.sendError(message, constants_1.AUTH_ACTIONS.MESSAGE_DENIED);
            return;
        }
        this.onAuthenticatedMessage(socketWrapper, message);
    }
}
exports.default = MessageProcessor;
//# sourceMappingURL=message-processor.js.map