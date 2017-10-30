"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const C = require("../../src/constants");
const events_1 = require("events");
class LoggerMock extends events_1.EventEmitter {
    constructor() {
        super();
        this.isReady = true;
        this.lastLogLevel = null;
        this.lastLogEvent = null;
        this.lastLogMessage = null;
        this.lastLogArguments = null;
        this._log = jasmine.createSpy('log');
    }
    warn(event, message) {
        this.log(C.LOG_LEVEL.WARN, event, message);
        this._log(C.LOG_LEVEL.WARN, event, message);
    }
    debug(event, message) {
        this.log(C.LOG_LEVEL.DEBUG, event, message);
        this._log(C.LOG_LEVEL.DEBUG, event, message);
    }
    info(event, message) {
        this.log(C.LOG_LEVEL.INFO, event, message);
        this._log(C.LOG_LEVEL.INFO, event, message);
    }
    error(event, message) {
        this.log(C.LOG_LEVEL.ERROR, event, message);
        this._log(C.LOG_LEVEL.ERROR, event, message);
    }
    log(level, event, message) {
        this.lastLogLevel = level;
        this.lastLogEvent = event;
        this.lastLogMessage = message;
        this.lastLogArguments = Array.from(arguments);
    }
    setLogLevel() {
    }
}
exports.default = LoggerMock;
//# sourceMappingURL=logger-mock.js.map