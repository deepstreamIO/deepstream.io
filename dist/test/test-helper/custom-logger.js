"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class CustomLogger extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.isReady = false;
        setTimeout(() => {
            this.isReady = true;
            this.emit('ready');
        }, 1);
    }
    log(level, event, msg) {
        console.log('CustomLogger:', level, event, msg);
    }
    setLogLevel() {
    }
}
exports.default = CustomLogger;
//# sourceMappingURL=custom-logger.js.map