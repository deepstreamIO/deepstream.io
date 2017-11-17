"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const constants_1 = require("../constants");
require('colors');
const EOL = require('os').EOL;
class StdOutLogger extends events_1.EventEmitter {
    /**
     * Logs to the operatingsystem's standard-out and standard-error streams.
     *
     * Consoles / Terminals as well as most log-managers and logging systems
     * consume messages from these streams
     */
    constructor(options) {
        super();
        this.options = options || {};
        this.isReady = true;
        this.useColors = this.options.colors === undefined ? true : this.options.colors;
        this.logLevelColors = [
            'white',
            'green',
            'yellow',
            'red',
        ];
        this.currentLogLevel = this.options.logLevel || constants_1.LOG_LEVEL.DEBUG;
        this.description = 'std out/err';
    }
    /**
     * Logs a line
     */
    log(logLevel, event, logMessage) {
        if (logLevel < this.currentLogLevel) {
            return;
        }
        const msg = `${event} | ${logMessage}`;
        let outputStream;
        if (logLevel === constants_1.LOG_LEVEL.ERROR || logLevel === constants_1.LOG_LEVEL.WARN) {
            outputStream = 'stderr';
        }
        else {
            outputStream = 'stdout';
        }
        // if (this.useColors) {
        // process[outputStream].write(msg[this.logLevelColors[logLevel]] + EOL)
        // } else {
        process[outputStream].write(msg + EOL);
        // }
    }
    debug(event, logMessage) {
        this.log(constants_1.LOG_LEVEL.DEBUG, event, logMessage);
    }
    info(event, logMessage) {
        this.log(constants_1.LOG_LEVEL.INFO, event, logMessage);
    }
    warn(event, logMessage) {
        this.log(constants_1.LOG_LEVEL.WARN, event, logMessage);
    }
    error(event, logMessage) {
        this.log(constants_1.LOG_LEVEL.ERROR, event, logMessage);
    }
    /**
     * Sets the log-level. This can be called at runtime.
     */
    setLogLevel(logLevel) {
        this.currentLogLevel = logLevel;
    }
}
exports.default = StdOutLogger;
//# sourceMappingURL=std-out-logger.js.map