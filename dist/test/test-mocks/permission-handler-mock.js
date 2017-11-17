"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PermissionHandlerMock {
    constructor(options) {
        this.isReady = true;
        this.options = options;
        this.reset();
    }
    reset() {
        this.nextCanPerformActionResult = true;
        this.lastCanPerformActionQueryArgs = null;
    }
    canPerformAction(username, message, callback) {
        this.lastCanPerformActionQueryArgs = arguments;
        if (typeof this.nextCanPerformActionResult === 'string') {
            callback(this.nextCanPerformActionResult);
        }
        else {
            callback(null, this.nextCanPerformActionResult);
        }
    }
}
exports.default = PermissionHandlerMock;
//# sourceMappingURL=permission-handler-mock.js.map