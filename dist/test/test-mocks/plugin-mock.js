"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const util = require('util');
class PluginMock extends events_1.EventEmitter {
    constructor(options, name) {
        super();
        this.isReady = false;
        this.description = name || 'mock-plugin';
        this.options = options;
    }
    setDeepstream(deepstream) {
    }
    setReady() {
        this.isReady = true;
        this.emit('ready');
    }
}
exports.default = PluginMock;
//# sourceMappingURL=plugin-mock.js.map