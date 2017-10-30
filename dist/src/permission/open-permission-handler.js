"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
/**
 * The open permission handler allows any action to occur without applying
 * any permissions.
 */
class OpenPermissionHandler extends events_1.EventEmitter {
    constructor() {
        super();
        this.description = 'none';
        this.isReady = true;
    }
    /**
    * Allows any action by an user
    */
    canPerformAction(username, message, callback, authData, socketWrapper) {
        callback(null, true);
    }
}
exports.default = OpenPermissionHandler;
//# sourceMappingURL=open-permission-handler.js.map