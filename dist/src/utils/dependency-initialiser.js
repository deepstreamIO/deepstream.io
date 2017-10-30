"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const constants_1 = require("../constants");
class DependencyInitialiser extends events_1.EventEmitter {
    /**
     * This class is used to track the initialisation of
     * an individual dependency (cache connector, persistance connector,
     * message connector, logger)
     */
    constructor(deepstream, config, services, dependency, name) {
        super();
        this.isReady = false;
        this.config = config;
        this.services = services;
        this.dependency = dependency;
        this.name = name;
        this.timeout = null;
        if (typeof this.dependency.on !== 'function' && typeof this.dependency.isReady === 'undefined') {
            const errorMessage = `${this.name} needs to implement isReady or be an emitter`;
            this.services.logger.error(constants_1.EVENT.PLUGIN_INITIALIZATION_ERROR, errorMessage);
            const error = (new Error(errorMessage));
            error.code = 'PLUGIN_INITIALIZATION_ERROR';
            throw error;
        }
        if (this.dependency.setDeepstream instanceof Function) {
            this.dependency.setDeepstream(deepstream);
        }
        if (this.dependency.isReady) {
            this._onReady();
        }
        else {
            this.timeout = setTimeout(this._onTimeout.bind(this), this.config.dependencyInitialisationTimeout);
            this.dependency.once('ready', this._onReady.bind(this));
            this.dependency.on('error', this._onError.bind(this));
            if (this.dependency.init) {
                this.dependency.init();
            }
        }
    }
    /**
     * Returns the underlying dependency (e.g. the Logger, StorageConnector etc.)
     */
    getDependency() {
        return this.dependency;
    }
    /**
     * Callback for succesfully initialised dependencies
     */
    _onReady() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.dependency.type = this.dependency.description || this.dependency.type;
        const dependencyType = this.dependency.type ? `: ${this.dependency.type}` : ': no dependency description provided';
        this.services.logger.info(constants_1.EVENT.INFO, `${this.name} ready${dependencyType}`);
        process.nextTick(this._emitReady.bind(this));
    }
    /**
     * Callback for dependencies that weren't initialised in time
     */
    _onTimeout() {
        const message = `${this.name} wasn't initialised in time`;
        this._logError(message);
        const error = (new Error(message));
        error.code = constants_1.EVENT.PLUGIN_INITIALIZATION_TIMEOUT;
        throw error;
    }
    /**
    * Handles errors emitted by the dependency at startup.
    *
    * Plugin errors that occur at runtime are handled by the deepstream.io main class
    */
    _onError(error) {
        if (this.isReady !== true) {
            this._logError(`Error while initialising ${this.name}: ${error.toString()}`);
            error.code = constants_1.EVENT.PLUGIN_INITIALIZATION_ERROR;
            throw error;
        }
    }
    /**
     * Emits the ready event after a one tick delay
     */
    _emitReady() {
        this.isReady = true;
        this.emit('ready');
    }
    /**
     * Logs error messages
     *
     * Since the logger is a dependency in its own right, it can't be relied upon
     * here. If it is available, it will be used, otherwise the error will be logged
     * straight to the console
     */
    _logError(message) {
        if (this.services.logger && this.services.logger.isReady) {
            this.services.logger.error(constants_1.EVENT.PLUGIN_ERROR, message);
        }
        else {
            console.error('Error while initialising dependency');
            console.error(message);
        }
    }
}
exports.default = DependencyInitialiser;
//# sourceMappingURL=dependency-initialiser.js.map