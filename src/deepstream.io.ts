require('source-map-support').install()

import { EOL } from 'os'
import { readFileSync } from 'fs'
import { join as joinPath } from 'path'
import { EventEmitter } from 'events'

import * as pkg from '../package.json'
import { combineEvents, merge } from './utils/utils'
import { STATES, EVENT, TOPIC } from './constants'

import MessageProcessor from './message/message-processor'
import MessageDistributor from './message/message-distributor'

import EventHandler from './event/event-handler'
import RpcHandler from './rpc/rpc-handler'
import PresenceHandler from './presence/presence-handler'
import RecordHandler from './record/record-handler'

import { get as getDefaultOptions } from './default-options'
import * as configInitialiser from './config/config-initialiser'
import * as jsYamlLoader from './config/js-yaml-loader'
import * as configValidator from './config/config-validator'

import MessageConnector from './cluster/cluster-node'
import LockRegistry from './cluster/lock-registry'
import DependencyInitialiser from './utils/dependency-initialiser'

/**
 * Sets the name of the process
 */
process.title = 'deepstream server'

export class Deepstream extends EventEmitter {
  public constants: any

  protected config: InternalDeepstreamConfig
  protected services: DeepstreamServices

  private messageProcessor: any
  private messageDistributor: any

  private eventHandler: EventHandler
  private rpcHandler: RpcHandler
  private recordHandler: RecordHandler
  private presenceHandler: PresenceHandler

  private stateMachine: any
  private currentState: any

  private configFile: string

/**
 * Deepstream is a realtime data server that supports data-sync,
 * publish-subscribe, request-response, listeneing, permissioning
 * and a host of other features!
 *
 * @copyright 2018 deepstreamHub GmbH
 * @author deepstreamHub GmbH
 *
 * @constructor
 */
  constructor (config: DeepstreamConfig | string | null) {
    super()
    this.loadConfig(config)
    this.messageProcessor = null
    this.messageDistributor = null

    this.stateMachine = {
      init: STATES.STOPPED,
      transitions: [
      { name: 'start', from: STATES.STOPPED, to: STATES.LOGGER_INIT, handler: this.loggerInit },
      { name: 'logger-started', from: STATES.LOGGER_INIT, to: STATES.PLUGIN_INIT, handler: this.pluginInit },
      { name: 'plugins-started', from: STATES.PLUGIN_INIT, to: STATES.SERVICE_INIT, handler: this.serviceInit },
      { name: 'services-started', from: STATES.SERVICE_INIT, to: STATES.CONNECTION_ENDPOINT_INIT, handler: this.connectionEndpointInit },
      { name: 'connection-endpoints-started', from: STATES.CONNECTION_ENDPOINT_INIT, to: STATES.RUNNING, handler: this.run },

      { name: 'stop', from: STATES.LOGGER_INIT, to: STATES.LOGGER_SHUTDOWN, handler: this.loggerShutdown },
      { name: 'stop', from: STATES.PLUGIN_INIT, to: STATES.PLUGIN_SHUTDOWN, handler: this.pluginShutdown },
      { name: 'stop', from: STATES.SERVICE_INIT, to: STATES.SERVICE_SHUTDOWN, handler: this.serviceShutdown },
      { name: 'stop', from: STATES.CONNECTION_ENDPOINT_INIT, to: STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this.connectionEndpointShutdown },
      { name: 'stop', from: STATES.RUNNING, to: STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this.connectionEndpointShutdown },

      { name: 'connection-endpoints-closed', from: STATES.CONNECTION_ENDPOINT_SHUTDOWN, to: STATES.SERVICE_SHUTDOWN, handler: this.serviceShutdown },
      { name: 'services-closed', from: STATES.SERVICE_SHUTDOWN, to: STATES.PLUGIN_SHUTDOWN, handler: this.pluginShutdown },
      { name: 'plugins-closed', from: STATES.PLUGIN_SHUTDOWN, to: STATES.LOGGER_SHUTDOWN, handler: this.loggerShutdown },
      { name: 'logger-closed', from: STATES.LOGGER_SHUTDOWN, to: STATES.STOPPED, handler: this.stopped },
      ]
    }
    this.currentState = this.stateMachine.init
  }

/**
 * Set a deepstream option. For a list of all available options
 * please see default-options.
 */
  public set (key: string, value: any): any {
    if (this.services[key] !== undefined) {
      this.services[key] = value
    } else if (this.config[key] !== undefined) {
      this.config[key] = value
    } else {
      throw new Error(`Unknown option or service "${key}"`)
    }
    return this
  }

/**
 * Returns true if the deepstream server is running, otherwise false
 */
  public isRunning (): boolean {
    return this.currentState === STATES.RUNNING
  }

/**
 * Starts up deepstream. The startup process has three steps:
 *
 * - First of all initialise the logger and wait for it (ready event)
 * - Then initialise all other dependencies (cache connector, message connector, storage connector)
 * - Instantiate the messaging pipeline and record-, rpc- and event-handler
 * - Start WS server
 */
  public start (): void {
    if (this.currentState !== STATES.STOPPED) {
      throw new Error(`Server can only start after it stops successfully. Current state: ${this.currentState}`)
    }
    this.showStartLogo()
    this.transition('start')
  }

/**
 * Stops the server and closes all connections. The server can be started again,
 * but all clients have to reconnect. Will emit a 'stopped' event once done
 */
  public stop (): void {
    if (this.currentState === STATES.STOPPED) {
      throw new Error('The server is already stopped.')
    }

    this.transition('stop')
  }

/* ======================================================================= *
 * ========================== State Transitions ========================== *
 * ======================================================================= */

/**
 * Try to perform a state change
 */
  private transition (transitionName: string): void {
    let transition
    for (let i = 0; i < this.stateMachine.transitions.length; i++) {
      transition = this.stateMachine.transitions[i]
      if (transitionName === transition.name && this.currentState === transition.from) {
      // found transition
        this.onTransition(transition)
        this.currentState = transition.to
        transition.handler.call(this)
        return
      }
    }
    const details = JSON.stringify({ transition: transitionName, state: this.currentState })
    throw new Error(`Invalid state transition: ${details}`)
  }

/**
 * Log state transitions for debugging.
 */
  private onTransition (transition: any): void {
    const logger = this.services.logger
    if (logger) {
      logger.debug(
        EVENT.INFO,
        `State transition (${transition.name}): ${STATES[transition.from]} -> ${STATES[transition.to]}`
      )
    }
  }

/**
 * First stage in the Deepstream initialisation sequence. Initialises the logger.
 */
  private loggerInit (): void {
    const logger = this.services.logger
    const loggerInitialiser = new DependencyInitialiser(this, this.config, this.services, logger, 'logger')
    loggerInitialiser.once('ready', () => {
      if (logger instanceof EventEmitter) {
        logger.on('error', this.onPluginError.bind(this, 'logger'))
      }
      this.transition('logger-started')
    })
  }

/**
 * Invoked once the logger is initialised. Initialises any built-in or custom Deepstream plugins.
 */
  protected pluginInit (): void {
    this.services.message = new MessageConnector(this.config, this.services, 'deepstream')

    const infoLogger = message => this.services.logger.info(EVENT.INFO, message)
    infoLogger(`deepstream version: ${pkg.version}`)

    // otherwise (no configFile) deepstream was invoked by API
    if (this.configFile != null) {
      infoLogger(`configuration file loaded from ${this.configFile}`)
    }

    if (global.deepstreamLibDir) {
      infoLogger(`library directory set to: ${global.deepstreamLibDir}`)
    }

    this.services.registeredPlugins.forEach(pluginType => {
      const plugin = this.services[pluginType]
      const initialiser = new DependencyInitialiser(this, this.config, this.services, plugin, pluginType)
      initialiser.once('ready', () => {
        this.checkReady(pluginType, plugin)
      })
      return initialiser
    })
  }

/**
 * Called whenever a dependency emits a ready event. Once all dependencies are ready
 * deepstream moves to the init step.
 */
  private checkReady (pluginType: string, plugin: DeepstreamPlugin): void {
    if (plugin instanceof EventEmitter) {
      plugin.on('error', this.onPluginError.bind(this, pluginType))
    }
    plugin.isReady = true

    const allPluginsReady = this.services.registeredPlugins.every(type => this.services[type].isReady)

    if (allPluginsReady && this.currentState === STATES.PLUGIN_INIT) {
      this.transition('plugins-started')
    }
  }

/**
 * Invoked once all plugins are initialised. Instantiates the messaging pipeline and
 * the various handlers.
 */
  protected serviceInit (): void {
    this.messageProcessor = new MessageProcessor(this.config, this.services)
    this.messageDistributor = new MessageDistributor(this.config, this.services)

    this.services.uniqueRegistry = new LockRegistry(this.config, this.services)

    this.eventHandler = new EventHandler(this.config, this.services)
    this.messageDistributor.registerForTopic(
      TOPIC.EVENT,
      this.eventHandler.handle.bind(this.eventHandler)
    )

    this.rpcHandler = new RpcHandler(this.config, this.services)
    this.messageDistributor.registerForTopic(
      TOPIC.RPC,
      this.rpcHandler.handle.bind(this.rpcHandler)
    )

    this.recordHandler = new RecordHandler(this.config, this.services)
    this.messageDistributor.registerForTopic(
      TOPIC.RECORD,
      this.recordHandler.handle.bind(this.recordHandler)
    )

    this.presenceHandler = new PresenceHandler(this.config, this.services)
    this.messageDistributor.registerForTopic(
      TOPIC.PRESENCE,
      this.presenceHandler.handle.bind(this.presenceHandler)
    )

    this.messageProcessor.onAuthenticatedMessage =
      this.messageDistributor.distribute.bind(this.messageDistributor)

    if (this.services.permissionHandler.setRecordHandler) {
      this.services.permissionHandler.setRecordHandler(this.recordHandler)
    }

    process.nextTick(() => this.transition('services-started'))
  }

/**
 * Invoked once all dependencies and services are initialised.
 * The startup sequence will be complete once the connection endpoint is started and listening.
 */
  private connectionEndpointInit (): void {
    const endpoints = this.services.connectionEndpoints
    const initialisers: Array<any> = []

    for (let i = 0; i < endpoints.length; i++) {
      const connectionEndpoint = endpoints[i]
      initialisers[i] = new DependencyInitialiser(
      this,
      this.config,
      this.services,
      connectionEndpoint,
      'connectionEndpoint'
    )

      connectionEndpoint.onMessages = this.messageProcessor.process.bind(this.messageProcessor)
      connectionEndpoint.on(
      'client-connected',
      this.presenceHandler.handleJoin.bind(this.presenceHandler)
    )
      connectionEndpoint.on(
      'client-disconnected',
      this.presenceHandler.handleLeave.bind(this.presenceHandler)
    )
    }

    combineEvents(initialisers, 'ready', () => this.transition('connection-endpoints-started'))
  }

/**
 * Initialization complete - Deepstream is up and running.
 */
  private run (): void {
    this.services.logger.info(EVENT.INFO, 'Deepstream started')
    this.emit('started')
  }

/**
 * Begin deepstream shutdown.
 * Closes the (perhaps partially initialised) connectionEndpoints.
 */
  private connectionEndpointShutdown (): void {
    const endpoints = this.services.connectionEndpoints
    endpoints.forEach(endpoint => {
      process.nextTick(() => endpoint.close())
    })

    combineEvents(endpoints, 'close', () => this.transition('connection-endpoints-closed'))
  }

/**
 * Shutdown the services.
 */
  private serviceShutdown (): void {
    this.services.message.close(() => this.transition('services-closed'))
  }

/**
 * Close any (perhaps partially initialised) plugins.
 */
  private pluginShutdown (): void {
    const closeablePlugins: Array<DeepstreamPlugin> = []
    this.services.registeredPlugins.forEach(pluginType => {
      const plugin = this.services[pluginType]
      if (typeof plugin.close === 'function') {
        process.nextTick(() => plugin.close())
        closeablePlugins.push(plugin)
      }
    })

    if (closeablePlugins.length > 0) {
      combineEvents(closeablePlugins, 'close', () => this.transition('plugins-closed'))
    } else {
      process.nextTick(() => this.transition('plugins-closed'))
    }
  }

/**
 * Close the (perhaps partially initialised) logger.
 */
  private loggerShutdown (): void {
    const logger = this.services.logger as any
    if (typeof logger.close === 'function') {
      process.nextTick(() => logger.close())
      logger.once('close', () => this.transition('logger-closed'))
      return
    }
    process.nextTick(() => this.transition('logger-closed'))
  }

/**
 * Final stop state.
 * Deepstream can now be started again.
 */
  private stopped (): void {
    this.emit('stopped')
  }

/**
 * Synchronously loads a configuration file
 * Initialization of plugins and logger will be triggered by the
 * configInitialiser, but it should not block. Instead the ready events of
 * those plugins are handled through the DependencyInitialiser in this instance.
 */
  private loadConfig (config: DeepstreamConfig | string | null): void {
    let result
    if (config === null || typeof config === 'string') {
      result = jsYamlLoader.loadConfig(config)
      this.configFile = result.file
    } else {
      const rawConfig = merge(getDefaultOptions(), config) as InternalDeepstreamConfig
      result = configInitialiser.initialise(rawConfig)
    }
    configValidator.validate(result.config)
    this.config = result.config
    this.services = result.services
  }

/**
 * Shows a giant ASCII art logo which is absolutely crucial
 * for the proper functioning of the server
 */
  private showStartLogo (): void {
    if (this.config.showLogo !== true) {
      return
    }
  /* istanbul ignore next */
    let logo

    try {
    const nexeres = require('nexeres')
    logo = nexeres.get('ascii-logo.txt').toString('ascii')
    } catch (e) {
      logo = readFileSync(joinPath(__dirname, '..', '..', '/ascii-logo.txt'), 'utf8')
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
 */
  private onPluginError (pluginName: string, error: Error): void {
    const msg = `Error from ${pluginName} plugin: ${error.toString()}`
    this.services.logger.error(EVENT.PLUGIN_ERROR, msg)
  }
}
