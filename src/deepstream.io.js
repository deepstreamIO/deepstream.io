'use strict'

const MessageProcessor = require('./message/message-processor')
const MessageDistributor = require('./message/message-distributor')
const EventHandler = require('./event/event-handler')
const messageParser = require('./message/message-parser')
const messageBuilder = require('./message/message-builder')
const readMessage = require('./utils/read-message')
const fs = require('fs')
const path = require('path')
const utils = require('./utils/utils')
const defaultOptions = require('./default-options')
const configInitialiser = require('./config/config-initialiser')
const jsYamlLoader = require('./config/js-yaml-loader')
const RpcHandler = require('./rpc/rpc-handler')
const RecordHandler = require('./record/record-handler')
const PresenceHandler = require('./presence/presence-handler')
const MessageConnector = require('./cluster/cluster-node')
const LockRegistry = require('./cluster/lock-registry')
const DependencyInitialiser = require('./utils/dependency-initialiser')
const C = require('./constants/constants')
const pkg = require('../package.json')

const EventEmitter = require('events').EventEmitter
const EOL = require('os').EOL

const STATES = C.STATES

module.exports = class Deepstream extends EventEmitter {
/**
 * Deepstream is a realtime data server that supports data-sync,
 * publish-subscribe, request-response, listeneing, permissioning
 * and a host of other features!
 *
 * @copyright 2016 deepstreamHub GmbH
 * @author deepstreamHub GmbH
 *
 * @param {Object} config Configuration object
 *
 * @constructor
 */
  constructor (config) {
    super()
    this.constants = C
    this._loadConfig(config)
    this._messageProcessor = null
    this._messageDistributor = null
    this._eventHandler = null
    this._rpcHandler = null
    this._recordHandler = null
    this._messageBuilder = messageBuilder

    this._stateMachine = {
      init: STATES.STOPPED,
      transitions: [
      { name: 'start', from: STATES.STOPPED, to: STATES.LOGGER_INIT, handler: this._loggerInit },
      { name: 'logger-started', from: STATES.LOGGER_INIT, to: STATES.PLUGIN_INIT, handler: this._pluginInit },
      { name: 'plugins-started', from: STATES.PLUGIN_INIT, to: STATES.SERVICE_INIT, handler: this._serviceInit },
      { name: 'services-started', from: STATES.SERVICE_INIT, to: STATES.CONNECTION_ENDPOINT_INIT, handler: this._connectionEndpointInit },
      { name: 'connection-endpoints-started', from: STATES.CONNECTION_ENDPOINT_INIT, to: STATES.RUNNING, handler: this._run },

      { name: 'stop', from: STATES.LOGGER_INIT, to: STATES.LOGGER_SHUTDOWN, handler: this._loggerShutdown },
      { name: 'stop', from: STATES.PLUGIN_INIT, to: STATES.PLUGIN_SHUTDOWN, handler: this._pluginShutdown },
      { name: 'stop', from: STATES.SERVICE_INIT, to: STATES.SERVICE_SHUTDOWN, handler: this._serviceShutdown },
      { name: 'stop', from: STATES.CONNECTION_ENDPOINT_INIT, to: STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this._connectionEndpointShutdown },
      { name: 'stop', from: STATES.RUNNING, to: STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this._connectionEndpointShutdown },

      { name: 'connection-endpoints-closed', from: STATES.CONNECTION_ENDPOINT_SHUTDOWN, to: STATES.SERVICE_SHUTDOWN, handler: this._serviceShutdown },
      { name: 'services-closed', from: STATES.SERVICE_SHUTDOWN, to: STATES.PLUGIN_SHUTDOWN, handler: this._pluginShutdown },
      { name: 'plugins-closed', from: STATES.PLUGIN_SHUTDOWN, to: STATES.LOGGER_SHUTDOWN, handler: this._loggerShutdown },
      { name: 'logger-closed', from: STATES.LOGGER_SHUTDOWN, to: STATES.STOPPED, handler: this._stop },
      ]
    }
    this._currentState = this._stateMachine.init
  }

/**
 * Set a deepstream option. For a list of all available options
 * please see default-options.
 *
 * @param {String} key   the name of the option
 * @param {Mixed} value  the value, e.g. a portnumber for ports or an instance of a logger class
 *
 * @public
 * @returns {void}
 */
  set (key, value) {
    if (this._options[key] === undefined) {
      throw new Error(`Unknown option "${key}"`)
    }

    this._options[key] = value
    return this
  }

/**
 * Returns true if the deepstream server is running, otherwise false
 *
 * @public
 * @returns {boolean}
 */
  isRunning () {
    return this._currentState === STATES.RUNNING
  }

/**
 * Starts up deepstream. The startup process has three steps:
 *
 * - First of all initialise the logger and wait for it (ready event)
 * - Then initialise all other dependencies (cache connector, message connector, storage connector)
 * - Instantiate the messaging pipeline and record-, rpc- and event-handler
 * - Start WS server
 *
 * @public
 * @returns {void}
 */
  start () {
    if (this._currentState !== STATES.STOPPED) {
      throw new Error(`Server can only start after it stops successfully. Current state: ${this._currentState}`)
    }
    this._showStartLogo()
    this._transition('start')
  }

/**
 * Stops the server and closes all connections. The server can be started again,
 * but all clients have to reconnect. Will emit a 'stopped' event once done
 *
 * @public
 * @returns {void}
 */
  stop () {
    if (this._currentState === STATES.STOPPED) {
      throw new Error('The server is already stopped.')
    }

    this._transition('stop')
  }

/**
 * Expose the message-parser's convertTyped method for use within plugins
 *
 * @param   {String} value A String starting with a type identifier (see C.TYPES)
 *
 * @public
 * @returns {JSValue} the converted value
 */
  convertTyped (value) { // eslint-disable-line
    return messageParser.convertTyped(value)
  }

/**
 * Expose the message-builder's typed method for use within plugins
 *
 * @param   {JSValue} value A javascript value
 *
 * @public
 * @returns {String} A type-prefixed string
 */
  toTyped (value) { // eslint-disable-line
    return messageBuilder.typed(value)
  }


/* ======================================================================= *
 * ========================== State Transitions ========================== *
 * ======================================================================= */

/**
 * Try to perform a state change
 *
 * @private
 * @returns {void}
 */
  _transition (transitionName) {
    let transition
    for (let i = 0; i < this._stateMachine.transitions.length; i++) {
      transition = this._stateMachine.transitions[i]
      if (transitionName === transition.name && this._currentState === transition.from) {
      // found transition
        this._onTransition(transition)
        this._currentState = transition.to
        transition.handler.call(this)
        return
      }
    }
    const details = JSON.stringify({ transition: transitionName, state: this._currentState })
    throw new Error(`Invalid state transition: ${details}`)
  }

/**
 * Log state transitions for debugging.
 *
 * @private
 * @returns {void}
 */
  _onTransition (transition) {
    const logger = this._options.logger
    if (logger) {
      logger.debug(
        C.EVENT.INFO,
        `State transition (${transition.name}): ${transition.from} -> ${transition.to}`
      )
    }
  }

/**
 * First stage in the Deepstream initialisation sequence. Initialises the logger.
 *
 * @private
 * @returns {void}
 */
  _loggerInit () {
    const logger = this._options.logger
    const loggerInitialiser = new DependencyInitialiser(this, this._options, logger, 'logger')
    loggerInitialiser.once('ready', () => {
      if (logger instanceof EventEmitter) {
        logger.on('error', this._onPluginError.bind(this, 'logger'))
      }
      this._transition('logger-started')
    })
  }

/**
 * Invoked once the logger is initialised. Initialises any built-in or custom Deepstream plugins.
 *
 * @private
 * @returns {void}
 */
  _pluginInit () {
    this._options.message = new MessageConnector(this._options, 'deepstream')

    const infoLogger = message => this._options.logger.info(C.EVENT.INFO, message)
    infoLogger(`deepstream version: ${pkg.version}`)

    // otherwise (no configFile) deepstream was invoked by API
    if (this._configFile != null) {
      infoLogger(`configuration file loaded from ${this._configFile}`)
    }

    if (global.deepstreamLibDir) {
      infoLogger(`library directory set to: ${global.deepstreamLibDir}`)
    }

    this._options.pluginTypes.forEach((pluginType) => {
      const plugin = this._options[pluginType]
      const initialiser = new DependencyInitialiser(this, this._options, plugin, pluginType)
      initialiser.once('ready', () => {
        this._checkReady(pluginType, plugin)
      })
      return initialiser
    })
  }

/**
 * Called whenever a dependency emits a ready event. Once all dependencies are ready
 * deepstream moves to the init step.
 *
 * @private
 * @returns {void}
 */
  _checkReady (pluginType, plugin) {
    if (plugin instanceof EventEmitter) {
      plugin.on('error', this._onPluginError.bind(this, pluginType))
    }
    plugin.isReady = true

    const allPluginsReady = this._options.pluginTypes.every(type => this._options[type].isReady)

    if (allPluginsReady && this._currentState === STATES.PLUGIN_INIT) {
      this._transition('plugins-started')
    }
  }

/**
 * Invoked once all plugins are initialised. Instantiates the messaging pipeline and
 * the various handlers.
 *
 * @private
 * @returns {void}
 */
  _serviceInit () {
    this._messageProcessor = new MessageProcessor(this._options)
    this._messageDistributor = new MessageDistributor(this._options)

    this._options.uniqueRegistry = new LockRegistry(this._options, this._options.message)

    this._eventHandler = new EventHandler(this._options)
    this._messageDistributor.registerForTopic(
    C.TOPIC.EVENT,
    this._eventHandler.handle.bind(this._eventHandler)
  )

    this._rpcHandler = new RpcHandler(this._options)
    this._messageDistributor.registerForTopic(
    C.TOPIC.RPC,
    this._rpcHandler.handle.bind(this._rpcHandler)
  )

    this._recordHandler = new RecordHandler(this._options)
    this._messageDistributor.registerForTopic(
    C.TOPIC.RECORD,
    this._recordHandler.handle.bind(this._recordHandler)
  )

    this._presenceHandler = new PresenceHandler(this._options)
    this._messageDistributor.registerForTopic(
    C.TOPIC.PRESENCE,
    this._presenceHandler.handle.bind(this._presenceHandler)
  )

    this._messageProcessor.onAuthenticatedMessage =
      this._messageDistributor.distribute.bind(this._messageDistributor)

    if (this._options.permissionHandler.setRecordHandler) {
      this._options.permissionHandler.setRecordHandler(this._recordHandler)
    }

    process.nextTick(() => this._transition('services-started'))
  }

/**
 * Invoked once all dependencies and services are initialised.
 * The startup sequence will be complete once the connection endpoint is started and listening.
 *
 * @private
 * @returns {void}
 */
  _connectionEndpointInit () {
    const endpoints = this._options.connectionEndpoints
    const initialisers = []

    for (let i = 0; i < endpoints.length; i++) {
      const connectionEndpoint = endpoints[i]
      initialisers[i] = new DependencyInitialiser(
      this,
      this._options,
      connectionEndpoint,
      'connectionEndpoint'
    )

      connectionEndpoint.onMessages = this._messageProcessor.process.bind(this._messageProcessor)
      connectionEndpoint.on(
      'client-connected',
      this._presenceHandler.handleJoin.bind(this._presenceHandler)
    )
      connectionEndpoint.on(
      'client-disconnected',
      this._presenceHandler.handleLeave.bind(this._presenceHandler)
    )
    }

    utils.combineEvents(initialisers, 'ready', () => this._transition('connection-endpoints-started'))
  }

/**
 * Initialization complete - Deepstream is up and running.
 *
 * @private
 * @returns {void}
 */
  _run () {
    this._options.logger.info(C.EVENT.INFO, 'Deepstream started')
    this.emit('started')
  }

/**
 * Begin deepstream shutdown.
 * Closes the (perhaps partially initialised) connectionEndpoints.
 *
 * @private
 * @returns {void}
 */
  _connectionEndpointShutdown () {
    const endpoints = this._options.connectionEndpoints
    endpoints.forEach((endpoint) => {
      process.nextTick(() => endpoint.close())
    })

    utils.combineEvents(endpoints, 'close', () => this._transition('connection-endpoints-closed'))
  }

/**
 * Shutdown the services.
 *
 * @private
 * @returns {void}
 */
  _serviceShutdown () {
    this._options.message.close(() => this._transition('services-closed'))
  }

/**
 * Close any (perhaps partially initialised) plugins.
 *
 * @private
 * @returns {void}
 */
  _pluginShutdown () {
    const closeablePlugins = []
    this._options.pluginTypes.forEach((pluginType) => {
      const plugin = this._options[pluginType]
      if (typeof plugin.close === 'function') {
        process.nextTick(() => plugin.close())
        closeablePlugins.push(plugin)
      }
    })

    if (closeablePlugins.length > 0) {
      utils.combineEvents(closeablePlugins, 'close', () => this._transition('plugins-closed'))
    } else {
      process.nextTick(() => this._transition('plugins-closed'))
    }
  }

/**
 * Close the (perhaps partially initialised) logger.
 *
 * @private
 * @returns {void}
 */
  _loggerShutdown () {
    const logger = this._options.logger
    if (typeof logger.close === 'function') {
      process.nextTick(() => logger.close())
      logger.once('close', () => this._transition('logger-closed'))
      return
    }
    process.nextTick(() => this._transition('logger-closed'))
  }

/**
 * Final stop state.
 * Deepstream can now be started again.
 *
 * @private
 * @returns {void}
 */
  _stop () {
    this.emit('stopped')
  }

/**
 * Synchronously loads a configuration file
 * Initialization of plugins and logger will be triggered by the
 * configInitialiser, but it should not block. Instead the ready events of
 * those plugins are handled through the DependencyInitialiser in this instance.
 *
 * @param {Object} config Configuration object
 * @private
 * @returns {void}
 */
  _loadConfig (config) {
    if (config === null || typeof config === 'string') {
      const result = jsYamlLoader.loadConfig(config)
      this._configFile = result.file
      this._options = result.config
    } else {
      const rawConfig = utils.merge(defaultOptions.get(), config)
      this._options = configInitialiser.initialise(rawConfig)
    }
  }

/**
 * Shows a giant ASCII art logo which is absolutely crucial
 * for the proper functioning of the server
 *
 * @private
 * @returns {void}
 */
  _showStartLogo () {
    if (this._options.showLogo !== true) {
      return
    }
  /* istanbul ignore next */
    let logo

    try {
    const nexeres = require('nexeres') // eslint-disable-line
      logo = nexeres.get('ascii-logo.txt').toString('ascii')
    } catch (e) {
      logo = fs.readFileSync(path.join(__dirname, '..', '/ascii-logo.txt'), 'utf8')
    }

  /* istanbul ignore next */
    process.stdout.write(logo + EOL)
    process.stdout.write(
    ` =====================   starting   =====================${EOL}`
  )
  }

/**
 * Callback for plugin errors that occur at runtime. Errors during initialisation
 * are handled by the DependencyInitialiser
 *
 * @param   {String} pluginName
 * @param   {Error} error
 *
 * @private
 * @returns {void}
 */
  _onPluginError (pluginName, error) {
    const msg = `Error from ${pluginName} plugin: ${error.toString()}`
    this._options.logger.error(C.EVENT.PLUGIN_ERROR, msg)
  }
}

/**
 * Sets the name of the process
 *
 * @type {String}
 */
process.title = 'deepstream server'

/**
 * Expose constants to allow consumers to access them without
 * requiring a reference to a deepstream instance.
 *
 * @type {Object}
*/
module.exports.constants = C

/**
 * Utility method to return a helper object to simplify permissions assertions
 *
 * @param  {object} message description
 * @return {object}         description
 */
module.exports.readMessage = readMessage
