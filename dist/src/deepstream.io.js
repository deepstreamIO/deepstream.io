"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('source-map-support').install();
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const events_1 = require("events");
const pkg = require("../package.json");
const utils_1 = require("./utils/utils");
const constants_1 = require("./constants");
const message_processor_1 = require("./message/message-processor");
const message_distributor_1 = require("./message/message-distributor");
const event_handler_1 = require("./event/event-handler");
const rpc_handler_1 = require("./rpc/rpc-handler");
const presence_handler_1 = require("./presence/presence-handler");
const record_handler_1 = require("./record/record-handler");
const default_options_1 = require("./default-options");
const configInitialiser = require("./config/config-initialiser");
const jsYamlLoader = require("./config/js-yaml-loader");
const configValidator = require("./config/config-validator");
const cluster_node_1 = require("./cluster/cluster-node");
const lock_registry_1 = require("./cluster/lock-registry");
const dependency_initialiser_1 = require("./utils/dependency-initialiser");
/**
 * Sets the name of the process
 */
process.title = 'deepstream server';
class Deepstream extends events_1.EventEmitter {
    /**
     * Deepstream is a realtime data server that supports data-sync,
     * publish-subscribe, request-response, listeneing, permissioning
     * and a host of other features!
     *
     * @copyright 2017 deepstreamHub GmbH
     * @author deepstreamHub GmbH
     *
     * @constructor
     */
    constructor(config) {
        super();
        this.loadConfig(config);
        this.messageProcessor = null;
        this.messageDistributor = null;
        this.stateMachine = {
            init: constants_1.STATES.STOPPED,
            transitions: [
                { name: 'start', from: constants_1.STATES.STOPPED, to: constants_1.STATES.LOGGER_INIT, handler: this.loggerInit },
                { name: 'logger-started', from: constants_1.STATES.LOGGER_INIT, to: constants_1.STATES.PLUGIN_INIT, handler: this.pluginInit },
                { name: 'plugins-started', from: constants_1.STATES.PLUGIN_INIT, to: constants_1.STATES.SERVICE_INIT, handler: this.serviceInit },
                { name: 'services-started', from: constants_1.STATES.SERVICE_INIT, to: constants_1.STATES.CONNECTION_ENDPOINT_INIT, handler: this.connectionEndpointInit },
                { name: 'connection-endpoints-started', from: constants_1.STATES.CONNECTION_ENDPOINT_INIT, to: constants_1.STATES.RUNNING, handler: this.run },
                { name: 'stop', from: constants_1.STATES.LOGGER_INIT, to: constants_1.STATES.LOGGER_SHUTDOWN, handler: this.loggerShutdown },
                { name: 'stop', from: constants_1.STATES.PLUGIN_INIT, to: constants_1.STATES.PLUGIN_SHUTDOWN, handler: this.pluginShutdown },
                { name: 'stop', from: constants_1.STATES.SERVICE_INIT, to: constants_1.STATES.SERVICE_SHUTDOWN, handler: this.serviceShutdown },
                { name: 'stop', from: constants_1.STATES.CONNECTION_ENDPOINT_INIT, to: constants_1.STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this.connectionEndpointShutdown },
                { name: 'stop', from: constants_1.STATES.RUNNING, to: constants_1.STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this.connectionEndpointShutdown },
                { name: 'connection-endpoints-closed', from: constants_1.STATES.CONNECTION_ENDPOINT_SHUTDOWN, to: constants_1.STATES.SERVICE_SHUTDOWN, handler: this.serviceShutdown },
                { name: 'services-closed', from: constants_1.STATES.SERVICE_SHUTDOWN, to: constants_1.STATES.PLUGIN_SHUTDOWN, handler: this.pluginShutdown },
                { name: 'plugins-closed', from: constants_1.STATES.PLUGIN_SHUTDOWN, to: constants_1.STATES.LOGGER_SHUTDOWN, handler: this.loggerShutdown },
                { name: 'logger-closed', from: constants_1.STATES.LOGGER_SHUTDOWN, to: constants_1.STATES.STOPPED, handler: this.stopped },
            ]
        };
        this.currentState = this.stateMachine.init;
    }
    /**
     * Set a deepstream option. For a list of all available options
     * please see default-options.
     */
    set(key, value) {
        if (this.services[key] !== undefined) {
            this.services[key] = value;
        }
        else if (this.config[key] !== undefined) {
            this.config[key] = value;
        }
        else {
            throw new Error(`Unknown option or service "${key}"`);
        }
        return this;
    }
    /**
     * Returns true if the deepstream server is running, otherwise false
     */
    isRunning() {
        return this.currentState === constants_1.STATES.RUNNING;
    }
    /**
     * Starts up deepstream. The startup process has three steps:
     *
     * - First of all initialise the logger and wait for it (ready event)
     * - Then initialise all other dependencies (cache connector, message connector, storage connector)
     * - Instantiate the messaging pipeline and record-, rpc- and event-handler
     * - Start WS server
     */
    start() {
        if (this.currentState !== constants_1.STATES.STOPPED) {
            throw new Error(`Server can only start after it stops successfully. Current state: ${this.currentState}`);
        }
        this.showStartLogo();
        this.transition('start');
    }
    /**
     * Stops the server and closes all connections. The server can be started again,
     * but all clients have to reconnect. Will emit a 'stopped' event once done
     */
    stop() {
        if (this.currentState === constants_1.STATES.STOPPED) {
            throw new Error('The server is already stopped.');
        }
        this.transition('stop');
    }
    /* ======================================================================= *
     * ========================== State Transitions ========================== *
     * ======================================================================= */
    /**
     * Try to perform a state change
     */
    transition(transitionName) {
        let transition;
        for (let i = 0; i < this.stateMachine.transitions.length; i++) {
            transition = this.stateMachine.transitions[i];
            if (transitionName === transition.name && this.currentState === transition.from) {
                // found transition
                this.onTransition(transition);
                this.currentState = transition.to;
                transition.handler.call(this);
                return;
            }
        }
        const details = JSON.stringify({ transition: transitionName, state: this.currentState });
        throw new Error(`Invalid state transition: ${details}`);
    }
    /**
     * Log state transitions for debugging.
     */
    onTransition(transition) {
        const logger = this.services.logger;
        if (logger) {
            logger.debug(constants_1.EVENT.INFO, `State transition (${transition.name}): ${constants_1.STATES[transition.from]} -> ${constants_1.STATES[transition.to]}`);
        }
    }
    /**
     * First stage in the Deepstream initialisation sequence. Initialises the logger.
     */
    loggerInit() {
        const logger = this.services.logger;
        const loggerInitialiser = new dependency_initialiser_1.default(this, this.config, this.services, logger, 'logger');
        loggerInitialiser.once('ready', () => {
            if (logger instanceof events_1.EventEmitter) {
                logger.on('error', this.onPluginError.bind(this, 'logger'));
            }
            this.transition('logger-started');
        });
    }
    /**
     * Invoked once the logger is initialised. Initialises any built-in or custom Deepstream plugins.
     */
    pluginInit() {
        this.services.message = new cluster_node_1.default(this.config, this.services, 'deepstream');
        const infoLogger = (message) => this.services.logger.info(constants_1.EVENT.INFO, message);
        infoLogger(`deepstream version: ${pkg.version}`);
        // otherwise (no configFile) deepstream was invoked by API
        if (this.configFile != null) {
            infoLogger(`configuration file loaded from ${this.configFile}`);
        }
        if (global.deepstreamLibDir) {
            infoLogger(`library directory set to: ${global.deepstreamLibDir}`);
        }
        this.services.registeredPlugins.forEach((pluginType) => {
            const plugin = this.services[pluginType];
            const initialiser = new dependency_initialiser_1.default(this, this.config, this.services, plugin, pluginType);
            initialiser.once('ready', () => {
                this.checkReady(pluginType, plugin);
            });
            return initialiser;
        });
    }
    /**
     * Called whenever a dependency emits a ready event. Once all dependencies are ready
     * deepstream moves to the init step.
     */
    checkReady(pluginType, plugin) {
        if (plugin instanceof events_1.EventEmitter) {
            plugin.on('error', this.onPluginError.bind(this, pluginType));
        }
        plugin.isReady = true;
        const allPluginsReady = this.services.registeredPlugins.every((type) => this.services[type].isReady);
        if (allPluginsReady && this.currentState === constants_1.STATES.PLUGIN_INIT) {
            this.transition('plugins-started');
        }
    }
    /**
     * Invoked once all plugins are initialised. Instantiates the messaging pipeline and
     * the various handlers.
     */
    serviceInit() {
        this.messageProcessor = new message_processor_1.default(this.config, this.services);
        this.messageDistributor = new message_distributor_1.default(this.config, this.services);
        this.services.uniqueRegistry = new lock_registry_1.default(this.config, this.services);
        this.eventHandler = new event_handler_1.default(this.config, this.services);
        this.messageDistributor.registerForTopic(constants_1.TOPIC.EVENT, this.eventHandler.handle.bind(this.eventHandler));
        this.rpcHandler = new rpc_handler_1.default(this.config, this.services);
        this.messageDistributor.registerForTopic(constants_1.TOPIC.RPC, this.rpcHandler.handle.bind(this.rpcHandler));
        this.recordHandler = new record_handler_1.default(this.config, this.services);
        this.messageDistributor.registerForTopic(constants_1.TOPIC.RECORD, this.recordHandler.handle.bind(this.recordHandler));
        this.presenceHandler = new presence_handler_1.default(this.config, this.services);
        this.messageDistributor.registerForTopic(constants_1.TOPIC.PRESENCE, this.presenceHandler.handle.bind(this.presenceHandler));
        this.messageProcessor.onAuthenticatedMessage =
            this.messageDistributor.distribute.bind(this.messageDistributor);
        if (this.services.permissionHandler.setRecordHandler) {
            this.services.permissionHandler.setRecordHandler(this.recordHandler);
        }
        process.nextTick(() => this.transition('services-started'));
    }
    /**
     * Invoked once all dependencies and services are initialised.
     * The startup sequence will be complete once the connection endpoint is started and listening.
     */
    connectionEndpointInit() {
        const endpoints = this.services.connectionEndpoints;
        const initialisers = [];
        for (let i = 0; i < endpoints.length; i++) {
            const connectionEndpoint = endpoints[i];
            initialisers[i] = new dependency_initialiser_1.default(this, this.config, this.services, connectionEndpoint, 'connectionEndpoint');
            connectionEndpoint.onMessages = this.messageProcessor.process.bind(this.messageProcessor);
            connectionEndpoint.on('client-connected', this.presenceHandler.handleJoin.bind(this.presenceHandler));
            connectionEndpoint.on('client-disconnected', this.presenceHandler.handleLeave.bind(this.presenceHandler));
        }
        utils_1.combineEvents(initialisers, 'ready', () => this.transition('connection-endpoints-started'));
    }
    /**
     * Initialization complete - Deepstream is up and running.
     */
    run() {
        this.services.logger.info(constants_1.EVENT.INFO, 'Deepstream started');
        this.emit('started');
    }
    /**
     * Begin deepstream shutdown.
     * Closes the (perhaps partially initialised) connectionEndpoints.
     */
    connectionEndpointShutdown() {
        const endpoints = this.services.connectionEndpoints;
        endpoints.forEach((endpoint) => {
            process.nextTick(() => endpoint.close());
        });
        utils_1.combineEvents(endpoints, 'close', () => this.transition('connection-endpoints-closed'));
    }
    /**
     * Shutdown the services.
     */
    serviceShutdown() {
        this.services.message.close(() => this.transition('services-closed'));
    }
    /**
     * Close any (perhaps partially initialised) plugins.
     */
    pluginShutdown() {
        const closeablePlugins = [];
        this.services.registeredPlugins.forEach((pluginType) => {
            const plugin = this.services[pluginType];
            if (typeof plugin.close === 'function') {
                process.nextTick(() => plugin.close());
                closeablePlugins.push(plugin);
            }
        });
        if (closeablePlugins.length > 0) {
            utils_1.combineEvents(closeablePlugins, 'close', () => this.transition('plugins-closed'));
        }
        else {
            process.nextTick(() => this.transition('plugins-closed'));
        }
    }
    /**
     * Close the (perhaps partially initialised) logger.
     */
    loggerShutdown() {
        const logger = this.services.logger;
        if (typeof logger.close === 'function') {
            process.nextTick(() => logger.close());
            logger.once('close', () => this.transition('logger-closed'));
            return;
        }
        process.nextTick(() => this.transition('logger-closed'));
    }
    /**
     * Final stop state.
     * Deepstream can now be started again.
     */
    stopped() {
        this.emit('stopped');
    }
    /**
     * Synchronously loads a configuration file
     * Initialization of plugins and logger will be triggered by the
     * configInitialiser, but it should not block. Instead the ready events of
     * those plugins are handled through the DependencyInitialiser in this instance.
     */
    loadConfig(config) {
        let result;
        if (config === null || typeof config === 'string') {
            result = jsYamlLoader.loadConfig(config);
            this.configFile = result.file;
        }
        else {
            const rawConfig = utils_1.merge(default_options_1.get(), config);
            result = configInitialiser.initialise(rawConfig);
        }
        configValidator.validate(result.config);
        this.config = result.config;
        this.services = result.services;
    }
    /**
     * Shows a giant ASCII art logo which is absolutely crucial
     * for the proper functioning of the server
     */
    showStartLogo() {
        if (this.config.showLogo !== true) {
            return;
        }
        /* istanbul ignore next */
        let logo;
        try {
            const nexeres = require('nexeres');
            logo = nexeres.get('ascii-logo.txt').toString('ascii');
        }
        catch (e) {
            logo = fs_1.readFileSync(path_1.join(__dirname, '..', '..', '/ascii-logo.txt'), 'utf8');
        }
        /* istanbul ignore next */
        process.stdout.write(logo + os_1.EOL);
        process.stdout.write(` =====================   starting   =====================${os_1.EOL}`);
    }
    /**
     * Callback for plugin errors that occur at runtime. Errors during initialisation
     * are handled by the DependencyInitialiser
     */
    onPluginError(pluginName, error) {
        const msg = `Error from ${pluginName} plugin: ${error.toString()}`;
        this.services.logger.error(constants_1.EVENT.PLUGIN_ERROR, msg);
    }
}
exports.Deepstream = Deepstream;
//# sourceMappingURL=deepstream.io.js.map