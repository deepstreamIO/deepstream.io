"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("../protocol/binary/src/message-constants"));
var LOG_LEVEL;
(function (LOG_LEVEL) {
    LOG_LEVEL[LOG_LEVEL["DEBUG"] = 0] = "DEBUG";
    LOG_LEVEL[LOG_LEVEL["INFO"] = 1] = "INFO";
    LOG_LEVEL[LOG_LEVEL["WARN"] = 2] = "WARN";
    LOG_LEVEL[LOG_LEVEL["ERROR"] = 3] = "ERROR";
    LOG_LEVEL[LOG_LEVEL["OFF"] = 100] = "OFF";
})(LOG_LEVEL = exports.LOG_LEVEL || (exports.LOG_LEVEL = {}));
var STATES;
(function (STATES) {
    STATES[STATES["STOPPED"] = 0] = "STOPPED";
    STATES[STATES["LOGGER_INIT"] = 1] = "LOGGER_INIT";
    STATES[STATES["PLUGIN_INIT"] = 2] = "PLUGIN_INIT";
    STATES[STATES["SERVICE_INIT"] = 3] = "SERVICE_INIT";
    STATES[STATES["CONNECTION_ENDPOINT_INIT"] = 4] = "CONNECTION_ENDPOINT_INIT";
    STATES[STATES["RUNNING"] = 5] = "RUNNING";
    STATES[STATES["CONNECTION_ENDPOINT_SHUTDOWN"] = 6] = "CONNECTION_ENDPOINT_SHUTDOWN";
    STATES[STATES["SERVICE_SHUTDOWN"] = 7] = "SERVICE_SHUTDOWN";
    STATES[STATES["PLUGIN_SHUTDOWN"] = 8] = "PLUGIN_SHUTDOWN";
    STATES[STATES["LOGGER_SHUTDOWN"] = 9] = "LOGGER_SHUTDOWN";
})(STATES = exports.STATES || (exports.STATES = {}));
//# sourceMappingURL=constants.js.map