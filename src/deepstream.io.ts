require('source-map-support').install()

import { EventEmitter } from 'events'

import * as pkg from '../package.json'
import { merge } from './utils/utils'
import { STATES, TOPIC } from './constants'

import MessageProcessor from './utils/message-processor'
import MessageDistributor from './utils/message-distributor'

import EventHandler from './handlers/event/event-handler'
import RpcHandler from './handlers/rpc/rpc-handler'
import PresenceHandler from './handlers/presence/presence-handler'
import MonitoringHandler from './handlers/monitoring/monitoring'

import { get as getDefaultOptions } from './default-options'
import * as configInitializer from './config/config-initialiser'
import * as jsYamlLoader from './config/js-yaml-loader'

import { DependencyInitialiser } from './utils/dependency-initialiser'
import { DeepstreamConfig, DeepstreamServices, DeepstreamPlugin, PartialDeepstreamConfig, EVENT, SocketWrapper, ConnectionListener } from '@deepstream/types'
import RecordHandler from './handlers/record/record-handler'
import { getValue, setValue } from './utils/json-path'
import { CombineAuthentication } from './services/authentication/combine/combine-authentication'

/**
 * Sets the name of the process
 */
process.title = 'deepstream server'

export class Deepstream extends EventEmitter {
  public constants: any

  private configFile!: string

  private config!: DeepstreamConfig
  private services!: DeepstreamServices

  private messageProcessor: any
  private messageDistributor: any

  private eventHandler!: EventHandler
  private rpcHandler!: RpcHandler
  private recordHandler!: RecordHandler
  private presenceHandler!: PresenceHandler
  private monitoringHandler!: MonitoringHandler

  private connectionListeners = new Set<ConnectionListener>()

  private stateMachine: any
  private currentState: STATES

  private overrideSettings: Array<{key: string, value: any}> = []
  private startWhenLoaded: boolean = false

/**
 * Deepstream is a realtime data server that supports data-sync,
 * publish-subscribe, request-response, listening, permissions
 * and a host of other features!
 */
  constructor (config: PartialDeepstreamConfig | string | null = null) {
    super()

    this.stateMachine = {
      init: STATES.STOPPED,
      transitions: [
      { name: 'loading-config', from: STATES.STOPPED, to: STATES.CONFIG_LOADED, handler: this.configLoaded },
      { name: 'start', from: STATES.CONFIG_LOADED, to: STATES.LOGGER_INIT, handler: this.loggerInit },
      { name: 'logger-started', from: STATES.LOGGER_INIT, to: STATES.SERVICE_INIT, handler: this.serviceInit },
      { name: 'services-started', from: STATES.SERVICE_INIT, to: STATES.HANDLER_INIT, handler: this.handlerInit },
      { name: 'handlers-started', from: STATES.HANDLER_INIT, to: STATES.PLUGIN_INIT, handler: this.pluginsInit },
      { name: 'plugins-started', from: STATES.PLUGIN_INIT, to: STATES.CONNECTION_ENDPOINT_INIT, handler: this.connectionEndpointInit },
      { name: 'connection-endpoints-started', from: STATES.CONNECTION_ENDPOINT_INIT, to: STATES.RUNNING, handler: this.run },

      { name: 'stop', from: STATES.LOGGER_INIT, to: STATES.LOGGER_SHUTDOWN, handler: this.loggerShutdown },
      { name: 'stop', from: STATES.SERVICE_INIT, to: STATES.SERVICE_SHUTDOWN, handler: this.serviceShutdown },
      { name: 'stop', from: STATES.CONNECTION_ENDPOINT_INIT, to: STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this.connectionEndpointShutdown },
      { name: 'stop', from: STATES.PLUGIN_INIT, to: STATES.PLUGIN_SHUTDOWN, handler: this.pluginsShutdown },

      { name: 'stop', from: STATES.RUNNING, to: STATES.CONNECTION_ENDPOINT_SHUTDOWN, handler: this.connectionEndpointShutdown },
      { name: 'connection-endpoints-closed', from: STATES.CONNECTION_ENDPOINT_SHUTDOWN, to: STATES.PLUGIN_SHUTDOWN, handler: this.pluginsShutdown },
      { name: 'plugins-closed', from: STATES.PLUGIN_SHUTDOWN, to: STATES.HANDLER_SHUTDOWN, handler: this.handlerShutdown },
      { name: 'handlers-closed', from: STATES.HANDLER_SHUTDOWN, to: STATES.SERVICE_SHUTDOWN, handler: this.serviceShutdown },
      { name: 'services-closed', from: STATES.SERVICE_SHUTDOWN, to: STATES.LOGGER_SHUTDOWN, handler: this.loggerShutdown },
      { name: 'logger-closed', from: STATES.LOGGER_SHUTDOWN, to: STATES.STOPPED, handler: this.stopped },
      ]
    }
    this.currentState = this.stateMachine.init

    this.loadConfig(config)
    this.messageProcessor = null
    this.messageDistributor = null
  }

/**
 * Set a deepstream option. For a list of all available options
 * please see default-options.
 */
  public set (key: string, value: any): any {
    if (this.currentState === STATES.STOPPED) {
      this.overrideSettings.push({ key, value })
      return
    }

    if (key === 'storageExclusion') {
        throw new Error('storageExclusion has been replace with record.storageExclusionPrefixes instead, which is an array of prefixes')
    }

    if (key === 'auth') {
      throw new Error('auth has been replaced with authentication')
    }

    if (key === 'authentication') {
      this.services.authentication = new CombineAuthentication(value instanceof Array ? value : [value])
      return
    }

    if ((this.services as any)[key] !== undefined) {
      (this.services as any)[key] = value
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
 * - First of all initialize the logger and wait for it (ready event)
 * - Then initialize all other dependencies (cache connector, message connector, storage connector)
 * - Instantiate the messaging pipeline and record-, rpc- and event-handler
 * - Start WS server
 */
  public start (): void {
    if (this.currentState !== STATES.CONFIG_LOADED) {
      this.startWhenLoaded = true
      return
    }
    this.transition('start')
  }

/**
 * Stops the server and closes all connections. Will emit a 'stopped' event once done
 */
  public stop (): void {
    if (this.currentState === STATES.STOPPED) {
      throw new Error('The server is already stopped.')
    }

    if ([STATES.CONNECTION_ENDPOINT_SHUTDOWN, STATES.SERVICE_SHUTDOWN, STATES.PLUGIN_SHUTDOWN, STATES.LOGGER_SHUTDOWN].indexOf(this.currentState) !== -1) {
      this.services.logger.info(EVENT.INFO, `Server is currently shutting down, currently in state ${STATES[this.currentState]}`)
      return
    }

    this.transition('stop')
  }

  public getServices (): Readonly<DeepstreamServices> {
    return this.services
  }

  public getConfig (): Readonly<DeepstreamConfig> {
    return this.config
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
  private onTransition (transition: { from: STATES, to: STATES, name: string }): void {
    const logger = this.services.logger
    if (logger && STATES[transition.to] !== STATES.CONFIG_LOADED) {
      logger.debug(
        EVENT.INFO,
        `State transition (${transition.name}): ${STATES[transition.from]} -> ${STATES[transition.to]}`
      )
    }
  }

  private configLoaded (): void {
    if (this.startWhenLoaded) {
      this.overrideSettings.forEach((setting) => this.set(setting.key, setting.value))
      this.start()
    }
  }

/**
 * First stage in the Deepstream initialization sequence. Initialises the logger.
 */
  private async loggerInit (): Promise<void> {
    const logger = this.services.logger
    const loggerInitialiser = new DependencyInitialiser(this.config, this.services, logger, 'logger')
    await loggerInitialiser.whenReady()

    const infoLogger = (message: string) => this.services.logger.info(EVENT.INFO, message)
    infoLogger(`server name: ${this.config.serverName}`)
    infoLogger(`deepstream version: ${pkg.version}`)

    // otherwise (no configFile) deepstream was invoked by API
    if (this.configFile != null) {
      infoLogger(`configuration file loaded from ${this.configFile}`)
    }

    // @ts-ignore
    if (global.deepstreamLibDir) {
      // @ts-ignore
      infoLogger(`library directory set to: ${global.deepstreamLibDir}`)
    }

    this.transition('logger-started')
  }

  /**
   * Invoked once the logger is initialised. Initialises all deepstream services.
  */
  private async serviceInit () {
    const readyPromises = Object.keys(this.services).reduce((promises, serviceName) => {
      if (['connectionEndpoints', 'plugins', 'notifyFatalException', 'logger'].includes(serviceName)) {
        return promises
      }
      const service = (this.services as any)[serviceName] as DeepstreamPlugin
      const initialiser = new DependencyInitialiser(this.config, this.services, service, serviceName)
      promises.push(initialiser.whenReady())
      return promises
    }, [] as Array<Promise<void>>)

    await Promise.all(readyPromises)

    this.messageProcessor = new MessageProcessor(this.config, this.services)
    this.messageDistributor = new MessageDistributor(this.config, this.services)
    this.services.messageDistributor = this.messageDistributor

    this.transition('services-started')
  }

/**
 * Invoked once all plugins are initialised. Instantiates the messaging pipeline and
 * the various handlers.
 */
  private async handlerInit () {
    if (this.config.enabledFeatures.event) {
      this.eventHandler = new EventHandler(this.config, this.services)
      this.messageDistributor.registerForTopic(
        TOPIC.EVENT,
        this.eventHandler.handle.bind(this.eventHandler)
      )
    }

    if (this.config.enabledFeatures.rpc) {
      this.rpcHandler = new RpcHandler(this.config, this.services)
      this.messageDistributor.registerForTopic(
        TOPIC.RPC,
        this.rpcHandler.handle.bind(this.rpcHandler)
      )
    }

    if (this.config.enabledFeatures.record) {
      this.recordHandler = new RecordHandler(this.config, this.services)
      this.messageDistributor.registerForTopic(
        TOPIC.RECORD,
        this.recordHandler.handle.bind(this.recordHandler)
      )
    }

    if (this.config.enabledFeatures.presence) {
      this.presenceHandler = new PresenceHandler(this.config, this.services)
      this.messageDistributor.registerForTopic(
        TOPIC.PRESENCE,
        this.presenceHandler.handle.bind(this.presenceHandler)
      )
      this.connectionListeners.add(this.presenceHandler as ConnectionListener)
    }

    if (this.config.enabledFeatures.monitoring) {
      this.monitoringHandler = new MonitoringHandler(this.config, this.services)
      this.messageDistributor.registerForTopic(
        TOPIC.MONITORING,
        this.monitoringHandler.handle.bind(this.monitoringHandler)
      )
    }

    this.messageProcessor.onAuthenticatedMessage =
      this.messageDistributor.distribute.bind(this.messageDistributor)

    if (this.services.permission.setRecordHandler) {
      this.services.permission.setRecordHandler(this.recordHandler)
    }

    this.transition('handlers-started')
  }

  private async pluginsInit () {
    const readyPromises = Object.keys(this.services.plugins).reduce((promises, pluginName) => {
      const plugin = this.services.plugins[pluginName]
      if (isConnectionListener(plugin)) {
        this.connectionListeners.add(plugin)
      }
      const initialiser = new DependencyInitialiser(this.config, this.services, plugin, pluginName)
      promises.push(initialiser.whenReady())
      return promises
    }, [] as Array<Promise<void>>)

    await Promise.all(readyPromises)

    this.transition('plugins-started')
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
        this.config,
        this.services,
        connectionEndpoint,
        'connectionEndpoint'
      )

      connectionEndpoint.onMessages = this.messageProcessor.process.bind(this.messageProcessor)
      if (connectionEndpoint.setConnectionListener) {
        connectionEndpoint.setConnectionListener({
          onClientConnected: this.onClientConnected.bind(this),
          onClientDisconnected: this.onClientDisconnected.bind(this)
        })
      }
      readyPromises.push(dependencyInitialiser.whenReady())
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
 * Close any (perhaps partially initialised) plugins.
 */
private async pluginsShutdown () {
  const shutdownPromises = Object.keys(this.services.plugins).reduce((promises, pluginName) => {
    const plugin = this.services.plugins[pluginName]
    if (plugin.close) {
      promises.push(plugin.close())
    }
    return promises
  }, [] as Array<Promise<void>> )
  await Promise.all(shutdownPromises)
  this.transition('plugins-closed')
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

  private async handlerShutdown () {
    if (this.config.enabledFeatures.event) {
      await this.eventHandler.close()
    }
    if (this.config.enabledFeatures.rpc) {
      await this.rpcHandler.close()
    }
    if (this.config.enabledFeatures.record) {
      await this.recordHandler.close()
    }
    if (this.config.enabledFeatures.presence) {
      await this.presenceHandler.close()
    }
    if (this.config.enabledFeatures.monitoring) {
      await this.monitoringHandler.close()
    }
    this.transition('handlers-closed')
  }

  /**
   * Shutdown the services.
   */
  private async serviceShutdown (): Promise<void> {
    const shutdownPromises = Object.keys(this.services).reduce((promises, serviceName) => {
      const service = (this.services as any)[serviceName]
      if (service.close) {
        promises.push(service.close())
      }
      return promises
    }, [] as Array<Promise<void>> )
    await Promise.all(shutdownPromises)
    this.transition('services-closed')
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
  private async loadConfig (config: PartialDeepstreamConfig | string | null): Promise<void> {
    let result
    if (config === null || typeof config === 'string') {
      result = await jsYamlLoader.loadConfig(this, config)
      this.configFile = result.file
    } else {
      configInitializer.mergeConnectionOptions(config)
      const rawConfig = merge(getDefaultOptions(), config) as DeepstreamConfig
      result = configInitializer.initialize(this, rawConfig)
    }
    this.config = result.config
    this.services = result.services
    this.transition('loading-config')
  }

  private onClientConnected (socketWrapper: SocketWrapper): void {
    this.connectionListeners.forEach((connectionListener) => connectionListener.onClientConnected(socketWrapper))
  }

  private onClientDisconnected (socketWrapper: SocketWrapper): void {
    this.connectionListeners.forEach((connectionListener) => connectionListener.onClientDisconnected(socketWrapper))
  }
}

function isConnectionListener (object: any): object is ConnectionListener {
  return 'onClientConnected' in object && 'onClientDisconnected' in object
}

export default Deepstream
