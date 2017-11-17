"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const utils = require('util');
class ClosableLogger extends events_1.EventEmitter {
    constructor() {
        super();
        this.log = jasmine.createSpy('log');
        this.isReady = false;
        setTimeout(this._setReady.bind(this), 1);
    }
    setLogLevel() { }
    close() {
        setTimeout(this._setClosed.bind(this), 1);
    }
    _setReady() {
        this.isReady = true;
        this.emit('ready');
    }
    _setClosed() {
        this.isReady = false;
        this.emit('close');
    }
}
exports.default = ClosableLogger;
//# sourceMappingURL=closable-logger.js.map