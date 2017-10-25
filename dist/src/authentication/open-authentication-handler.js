"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
/**
 * Used for users that don't provide a username
 */
const OPEN = 'open';
/**
 * The open authentication handler allows every client to connect.
 * If the client specifies a username as part of its authentication
 * data, it will be used to identify the user internally
 */
class OpenAuthenticationHandler extends events_1.EventEmitter {
    constructor() {
        super();
        this.description = 'none';
        this.isReady = true;
    }
    /**
    * Grants access to any user. Registeres them with username or open
    */
    isValidUser(connectionData, authData, callback) {
        callback(true, { username: authData.username || OPEN });
    }
}
exports.default = OpenAuthenticationHandler;
//# sourceMappingURL=open-authentication-handler.js.map