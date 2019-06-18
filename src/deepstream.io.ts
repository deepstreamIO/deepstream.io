require('source-map-support').install()

import { EOL } from 'os'
import { readFileSync } from 'fs'
import { join as joinPath } from 'path'
import { EventEmitter } from 'events'

import * as pkg from '../package.json'
import { merge } from './utils/utils'
import * as constants_ from './constants'
const { STATES, EVENT, TOPIC } = constants_

import MessageProcessor from './message/message-processor'
import MessageDistributor from './message/message-distributor'

import EventHandler from './event/event-handler'
import RpcHandler from './rpc/rpc-handler'
import PresenceHandler from './presence/presence-handler'
import RecordHandler from './record/record-handler'
import MonitoringHandler from './monitoring/monitoring'

import { get as getDefaultOptions } from './default-options'
import * as configInitialiser from './config/config-initialiser'
import * as jsYamlLoader from './config/js-yaml-loader'
import * as configValidator from './config/config-validator'

import DependencyInitialiser from './utils/dependency-initialiser'
import { SubscriptionRegistryFactory } from './utils/SubscriptionRegistryFactory'
import { InternalDeepstreamConfig, DeepstreamServices, DeepstreamConfig, DeepstreamPlugin } from './types'
import { getValue, setValue } from './record/json-path'

/**
 * Sets the name of the process
 */
process.title = 'deepstream server'

export const constants = constants_

export class Deepstream extends EventEmitter {
  public constants: any

  private configFile!: string

  protected config!: InternalDeepstreamConfig
  protected services!: DeepstreamServices

  private messageProcessor: any
  private messageDistributor: any

  private eventHandler!: EventHandler
  private rpcHandler!: RpcHandler
  private recordHandler!: RecordHandler
  private presenceHandler!: PresenceHandler
  private monitoringHandler!: MonitoringHandler

  private stateMachine: any
  private currentState: any

/**
 * Deepstream is a realtime data server that supports data-sync,
 * Deepstream is a realtime data server that supports data-sync,
 * publish-subscribe, request-response, listeneing, permissioning
 * and a host of other features!
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
    if (key === 'storageExclusion') {
        throw new Error('storageExclusion has been replace with record.storageExclusionPrefixes instead, which is an array of prefixes')
    }

    if ((this.services as any)[key] !== undefined) {
      (this.services as any)[key] = value
      if (key === 'storage' || key === 'cache') {
        if ((this.services as any)[key].apiVersion !== 2) {
          configInitialiser.storageCompatability((this.services as any)[key])
        }
      }
    } else if (getValue(this.config, key) !== undefined) {
      setValue(this.config, key, value)
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
 * Stops the server and closes all connections. Will emit a 'stopped' event once done
 */
  public stop (): void {
    if (this.currentState === STATES.STOPPED) {
      throw new Error('The server is already stopped.')
    }

    if ([STATES.CONNECTION_ENDPOINT_SHUTDOWN, STATES.PLUGIN_SHUTDOWN, STATES.LOGGER_SHUTDOWN].indexOf(this.currentState) !== -1) {
      this.services.logger.info(EVENT.INFO, `Server is currently shutting down, currently in state ${STATES[this.currentState]}`)
      return
    }

    this.transition('stop')
  }

  public getServices (): Readonly<DeepstreamServices> {
    return this.services
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
        this.emit(EVENT.DEEPSTREAM_STATE_CHANGED, this.currentState)
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
    this.services.subscriptions = new SubscriptionRegistryFactory(this.config, this.services)

    const infoLogger = (message: string) => this.services.logger.info(EVENT.INFO, message)
    infoLogger(`server name: ${this.config.serverName}`)
    infoLogger(`deepstream version: ${pkg.version}`)

    // otherwise (no configFile) deepstream was invoked by API
    if (this.configFile != null) {
      infoLogger(`configuration file loaded from ${this.configFile}`)
    }

    if (global.deepstreamLibDir) {
      infoLogger(`library directory set to: ${global.deepstreamLibDir}`)
    }

    this.services.registeredPlugins.forEach((pluginType) => {
      const plugin = (this.services as any)[pluginType]
      if (!plugin) {
        process.exit(1)
      }
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

    const allPluginsReady = this.services.registeredPlugins.every((type) => (this.services as any)[type].isReady)

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
    this.services.messageDistributor = this.messageDistributor

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

    this.monitoringHandler = new MonitoringHandler(this.config, this.services)
    this.messageDistributor.registerForTopic(
      TOPIC.MONITORING,
      this.monitoringHandler.handle.bind(this.monitoringHandler)
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
  private async connectionEndpointInit (): Promise<void> {
    const endpoints = this.services.connectionEndpoints
    const readyPromises: Array<Promise<void>> = []

    for (let i = 0; i < endpoints.length; i++) {
      const connectionEndpoint = endpoints[i]
      const dependencyInitialiser = new DependencyInitialiser(
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

      readyPromises.push(new Promise((resolve) => dependencyInitialiser.on('ready', resolve)))
    }

    await Promise.all(readyPromises)
    this.transition('connection-endpoints-started')
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
  private async connectionEndpointShutdown (): Promise<void> {
    const closeCallbacks = this.services.connectionEndpoints.map((endpoint) => endpoint.close())
    await Promise.all(closeCallbacks)
    this.transition('connection-endpoints-closed')
  }

/**
 * Shutdown the services.
 */
  private async serviceShutdown (): Promise<void> {
    await this.services.message.close()
    this.transition('services-closed')
  }

/**
 * Close any (perhaps partially initialised) plugins.
 */
  private async pluginShutdown (): Promise<void> {
    const closeCallbacks = this.services.registeredPlugins.map((pluginType) => {
      const plugin = (this.services as any)[pluginType]
      return plugin.close()
    })
    await Promise.all(closeCallbacks)
    this.transition('plugins-closed')
  }

/**
 * Close the (perhaps partially initialised) logger.
 */
  private async loggerShutdown () {
    const logger = this.services.logger as any
    await logger.close()
    this.transition('logger-closed')
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
    const logo = readFileSync(joinPath(__dirname, '..', '/ascii-logo.txt'), 'utf8')

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
    if (this.config.exitOnPluginError) {
      process.exit(1)
    }
  }
}

export default Deepstream
