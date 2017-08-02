const ConnectionEndpoint = require('./message/connection-endpoint')
const MessageProcessor = require('./message/message-processor')
const EventHandler = require('./event/event-handler')
const util = require('util')
const defaultOptions = require('./default-options')
const RpcHandler = require('./rpc/rpc-handler')
const RecordHandler = require('./record/record-handler')
const PresenceHandler = require('./presence/presence-handler')
const DependencyInitialiser = require('./utils/dependency-initialiser')
const C = require('./constants/constants')
const pkg = require('../package.json')

const EventEmitter = require('events').EventEmitter

const STATES = C.STATES

/**
 * Deepstream is a realtime data server that scales horizontally
 * by running in clusters of interacting nodes
 *
 * @copyright 2016 deepstreamHub GmbH
 * @author deepstreamHub GmbH
 *
 * @param {Object} config Configuration object
 *
 * @constructor
 */
const Deepstream = function (config) {
  this._currentState = STATES.CLOSED
  this.constants = C
  this._loadConfig(config)
  this._connectionEndpoint = null
  this._messageProcessor = null
  this._eventHandler = null
  this._rpcHandler = null
  this._recordHandler = null
  this._plugins = [
    'storageConnector',
    'authenticationHandler',
    'permissionHandler'
  ]
}

util.inherits(Deepstream, EventEmitter)

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
 *
*/
Deepstream.constants = C

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
Deepstream.prototype.set = function (key, value) {
  if (this._options[key] === undefined && this._plugins.indexOf(key) === -1) {
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
Deepstream.prototype.isRunning = function () {
  return this._currentState === STATES.IS_RUNNING
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
Deepstream.prototype.start = function () {
  if (this._currentState !== STATES.CLOSED) {
    throw new Error(`Server can only start after it stops succesfully, currently ${this._currentState}`)
  }
  this._currentState = STATES.STARTING
  const loggerInitializer = new DependencyInitialiser(this._options, 'logger')
  loggerInitializer.once('ready', this._start.bind(this))
}

/**
 * This is the actual function which starts deepstream. It is invoked after+
 * the logger was intialized or emitted the read event if it was initialized
 * asynchronously
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._start = function () {
  this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, `deepstream version: ${pkg.version}`)

  // otherwise (no configFile) deepstream was invoked by API
  if (this._configFile != null) {
    this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, `configuration file loaded from ${this._configFile}`)
  }

  if (global.deepstreamLibDir) {
    this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, `library directory set to: ${global.deepstreamLibDir}`)
  }

  let i
  let initialiser

  for (i = 0; i < this._plugins.length; i++) {
    initialiser = new DependencyInitialiser(this._options, this._plugins[i])
    initialiser.once('ready', this._checkReady.bind(this, this._plugins[i], initialiser.getDependency()))
  }
  this._checkReady('logger', this._options.logger)
}

/**
 * Stops the server and closes all connections. The server can be started again,
 * but all clients have to reconnect. Will emit a 'stopped' event once done
 *
 * @public
 * @returns {void}
 */
Deepstream.prototype.stop = function () {
  if (this._currentState !== STATES.IS_RUNNING) {
    throw new Error(`Server can only be stopped after it starts succesfully, currently ${this._currentState}`)
  }
  this._currentState = STATES.CLOSING

  let i
  let plugin
  const closables = [this._connectionEndpoint]

  if (typeof this._options.logger.close === 'function') {
    closables.push(this._options.logger)
    setTimeout(this._options.logger.close.bind(this._options.logger))
  }

  for (i = 0; i < this._plugins.length; i++) {
    plugin = this._options[this._plugins[i]]
    if (typeof plugin.close === 'function') {
      closables.push(plugin)
      setTimeout(plugin.close.bind(plugin))
    }
  }

  for (const closable of closables) {
    closable.on('close', () => {
      closables.splice(closables.indexOf(closable), 1)
      if (closables.length === 0) {
        this._onStopped()
      }
    })
  }
  this._connectionEndpoint.close()
}

/**
 * Synchronously loads a configuration file
 * Initialization of plugins and logger will be triggered by the
 * configInitialiser, but it should not block. Instead the ready events of
 * those plugins are handled through the DependencyInitialiser in this instnace.
 *
 * @param {Object} config Configuration object
 * @private
 * @returns {void}
 */
Deepstream.prototype._loadConfig = function (config) {
  this._options = Object.assign(defaultOptions.get(), config)
}

/**
 * Callback for the final stop event
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._onStopped = function () {
  this._currentState = STATES.CLOSED
  this.emit('stopped')
}

/**
 * Invoked once all dependencies are initialised. Instantiates the messaging pipeline and the various handlers.
 * The startup sequence will be complete once the connection endpoint is started and listening
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._init = function () {
  this._messageProcessor = new MessageProcessor(this._options)

  this._connectionEndpoint = new ConnectionEndpoint(this._options)
  this._connectionEndpoint.setDeepstream(this)
  this._connectionEndpoint.on('ready', this._onStarted.bind(this))
  this._connectionEndpoint.onMessage = this._messageProcessor.process.bind(this._messageProcessor)
  this._connectionEndpoint.init()

  this._options.connectionEndpoint = this._connectionEndpoint

  this._eventHandler = new EventHandler(this._options)
  this._rpcHandler = new RpcHandler(this._options)
  this._recordHandler = new RecordHandler(this._options)
  this._presenceHandler = new PresenceHandler(this._options)

  this._messageProcessor.onAuthenticatedMessage = (socket, message) => {
    if (message.topic === C.TOPIC.RECORD) {
      this._recordHandler.handle(socket, message)
    } else if (message.topic === C.TOPIC.EVENT) {
      this._eventHandler.handle(socket, message)
    } else if (message.topic === C.TOPIC.RPC) {
      this._rpcHandler.handle(socket, message)
    } else if (message.topic === C.TOPIC.PRESENCE) {
      this._presenceHandler.handle(socket, message)
    } else {
      socket.sendError(C.TOPIC.ERROR, C.EVENT.UNKNOWN_TOPIC, message.topic)
    }
  }

  if (this._options.permissionHandler.setRecordHandler) {
    this._options.permissionHandler.setRecordHandler(this._recordHandler)
  }

  if (this._options.authenticationHandler.setRecordHandler) {
    this._options.authenticationHandler.setRecordHandler(this._recordHandler)
  }

  this._currentState = STATES.INITIALIZED
}

/**
 * Called whenever a dependency emits a ready event. Once all dependencies are ready
 * deepstream moves to the init step.
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._checkReady = function (pluginName, plugin) {
  if (plugin instanceof EventEmitter) {
    plugin.on('error', this._onPluginError.bind(this, pluginName))
  }

  for (let i = 0; i < this._plugins.length; i++) {
    if (this._options[this._plugins[i]].isReady !== true) {
      return
    }
  }

  if (this._currentState === STATES.STARTING) {
    this._init()
  }
}

/**
 * Final callback - Deepstream is up and running now
 *
 * @private
 * @returns {void}
 */
Deepstream.prototype._onStarted = function () {
  this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, 'Deepstream started')
  this._currentState = STATES.IS_RUNNING
  this.emit('started')
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
Deepstream.prototype._onPluginError = function (pluginName, error) {
  const msg = `Error from ${pluginName} plugin: ${error.toString()}`
  this._options.logger.log(C.LOG_LEVEL.ERROR, C.EVENT.PLUGIN_ERROR, msg)
}

module.exports = Deepstream
