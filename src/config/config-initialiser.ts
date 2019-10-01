import * as utils from '../utils/utils'
import * as fileUtils from './file-utils'
import { DeepstreamConfig, DeepstreamServices, DeepstreamConnectionEndpoint, PluginConfig, DeepstreamLogger, DeepstreamAuthentication, DeepstreamPermission, LOG_LEVEL, EVENT, DeepstreamMonitoring } from '../../ds-types/src/index'
import { DistributedClusterRegistry } from '../services/cluster-registry/distributed-cluster-registry'
import { SingleClusterNode } from '../services/cluster-node/single-cluster-node'
import { DefaultSubscriptionRegistryFactory } from '../services/subscription-registry/default-subscription-registry-factory'
import { HTTPConnectionEndpoint } from '../connection-endpoint/http/connection-endpoint'
import { OpenAuthentication } from '../services/authentication/open/open-authentication'
import { ConfigPermission } from '../services/permission/valve/config-permission'
import { OpenPermission } from '../services/permission/open/open-permission'
import { UWSConnectionEndpoint } from '../connection-endpoint/uws-binary/connection-endpoint'
import { WSConnectionEndpoint } from '../connection-endpoint/ws-binary/connection-endpoint'
import { WSTextConnectionEndpoint } from '../connection-endpoint/ws-text/connection-endpoint'
import { MQTTConnectionEndpoint } from '../connection-endpoint/mqtt/connection-endpoint'
import { WSJSONConnectionEndpoint } from '../connection-endpoint/ws-json/connection-endpoint'
import { FileBasedAuthentication } from '../services/authentication/file/file-based-authentication'
import { StorageBasedAuthentication } from '../services/authentication/storage/storage-based-authentication'
import { HttpAuthentication } from '../services/authentication/http/http-authentication'
import { NoopStorage } from '../services/storage/noop-storage'
import { LocalCache } from '../services/cache/local-cache'
import { StdOutLogger } from '../services/logger/std-out-logger'
import { NoopMonitoring } from '../services/monitoring/noop-monitoring'
import { DistributedLockRegistry } from '../services/lock/distributed-lock-registry'
import { DistributedStateRegistryFactory } from '../services/cluster-state/distributed-state-registry-factory'
import { get as getDefaultOptions } from '../default-options'
import Deepstream from '../deepstream.io'
import { NodeHTTP } from '../services/http/node/node-http'
import HTTPMonitoring from '../services/monitoring/http/monitoring-http'

let commandLineArguments: any

const customPlugins = new Map()

const defaultPlugins = new Map<keyof DeepstreamServices, any>([
  ['cache', LocalCache],
  ['storage', NoopStorage],
  ['logger', StdOutLogger],
  ['locks', DistributedLockRegistry],
  ['subscriptions', DefaultSubscriptionRegistryFactory],
  ['clusterRegistry', DistributedClusterRegistry],
  ['clusterStates', DistributedStateRegistryFactory],
  ['clusterNode', SingleClusterNode],
  ['httpService', NodeHTTP],
])

export const mergeConnectionOptions = function (config: any) {
  if (config && config.connectionEndpoints) {
    const defaultConfig = getDefaultOptions()
    for (const connectionEndpoint of config.connectionEndpoints) {
      const defaultPlugin = defaultConfig.connectionEndpoints.find((defaultEndpoint) => defaultEndpoint.type === connectionEndpoint.type)
      if (defaultPlugin) {
        connectionEndpoint.options = utils.merge(defaultPlugin.options, connectionEndpoint.options)
      }
    }
  }
}

/**
 * Registers plugins by name. Useful when wanting to include
 * custom plugins in a binary
 */
export const registerPlugin = function (name: string, construct: Function) {
  customPlugins.set(name, construct)
}

/**
 * Takes a configuration object and instantiates functional properties.
 * CLI arguments will be considered.
 */
export const initialise = function (deepstream: Deepstream, config: DeepstreamConfig): { config: DeepstreamConfig, services: DeepstreamServices } {
  commandLineArguments = global.deepstreamCLI || {}
  handleUUIDProperty(config)
  mergeConnectionOptions(config)

  const services = {} as DeepstreamServices
  services.notifyFatalException = () => {
    if (config.exitOnFatalError) {
      process.exit(1)
    } else {
      deepstream.emit(EVENT.FATAL_EXCEPTION)
    }
  }
  services.logger = handleLogger(config, services)

  const ll = config.logLevel
  services.subscriptions = new (resolvePluginClass(config.subscriptions, 'subscriptions', ll))(config.subscriptions.options, services, config)
  services.storage = new (resolvePluginClass(config.storage, 'storage', ll))(config.storage.options, services, config)
  services.cache = new (resolvePluginClass(config.cache, 'cache', ll))(config.cache.options, services, config)
  services.monitoring = handleMonitoring(config, services)
  services.authentication = handleAuthStrategy(config, services)
  services.permission = handlePermissionStrategy(config, services)
  services.connectionEndpoints = handleConnectionEndpoints(config, services)
  services.locks = new (resolvePluginClass(config.locks, 'locks', ll))(config.locks.options, services, config)
  services.clusterNode = new (resolvePluginClass(config.clusterNode, 'clusterNode', ll))(config.clusterNode.options, services, config)
  services.clusterRegistry = new (resolvePluginClass(config.clusterRegistry, 'clusterRegistry', ll))(config.clusterRegistry.options, services, config)
  services.clusterStates = new (resolvePluginClass(config.clusterStates, 'clusterStates', ll))(config.clusterStates.options, services, config)
  services.httpService = new (resolvePluginClass(config.httpServer, 'httpService', ll))(config.httpServer.options, services, config)

  handleCustomPlugins(config, services)

  return { config, services }
}

/**
 * Transform the UUID string config to a UUID in the config object.
 */
function handleUUIDProperty (config: DeepstreamConfig): void {
  if (config.serverName === 'UUID') {
    config.serverName = utils.getUid()
  }
}

/**
 * Initialize the logger and overwrite the root logLevel if it's set
 * CLI arguments will be considered.
 */
function handleLogger (config: DeepstreamConfig, services: DeepstreamServices): DeepstreamLogger {
  const configOptions = (config.logger || {}).options
  if (commandLineArguments.colors !== undefined) {
    configOptions.colors = commandLineArguments.colors
  }
  let LoggerClass
  if (config.logger.type === 'default') {
    LoggerClass = StdOutLogger
  } else {
    LoggerClass = resolvePluginClass(config.logger, 'logger', config.logLevel)
  }

  if (configOptions instanceof Array) {
    // Note: This will not work on options without filename, and
    // is biased against for the winston logger
    let options
    for (let i = 0; i < configOptions.length; i++) {
      options = configOptions[i].options
      if (options && options.filename) {
        options.filename = fileUtils.lookupConfRequirePath(options.filename)
      }
    }
  }
  const logger = new LoggerClass(configOptions, services, config)
  if (logger.log) {
    logger.debug = logger.debug || logger.log.bind(logger, LOG_LEVEL.DEBUG)
    logger.info = logger.info || logger.log.bind(logger, LOG_LEVEL.INFO)
    logger.warn = logger.warn || logger.log.bind(logger, LOG_LEVEL.WARN)
    logger.error = logger.error || logger.log.bind(logger, LOG_LEVEL.ERROR)
  }

  if (LOG_LEVEL[config.logLevel]) {
    // NOTE: config.logLevel has highest priority, compare to the level defined
    // in the nested logger object
    config.logLevel = config.logLevel
    logger.setLogLevel(LOG_LEVEL[config.logLevel])
  }

  return logger
}

/**
 * Handle the plugins property in the config object the connectors.
 * Plugins can be passed either as a __path__ property or as a __name__ property with
 * a naming convention: *{cache: {name: 'redis'}}* will be resolved to the
 * npm module *@deepstream/cache-redis*
 * Options to the constructor of the plugin can be passed as *options* object.
 *
 * CLI arguments will be considered.
 */
function handleCustomPlugins (config: DeepstreamConfig, services: any): void {
  services.plugins = {}

  if (config.plugins == null) {
    return
  }
  const plugins = { ...config.plugins }

  for (const key in plugins) {
    const plugin = plugins[key]
    if (plugin) {
      const PluginConstructor = resolvePluginClass(plugin, key, config.logLevel)
      services.plugins[key] = new PluginConstructor(plugin.options || {}, services, config)
    }
  }
}

/**
 * Handle connection endpoint plugin config.
 * The type is typically the protocol e.g. ws
 * Plugins can be passed either as a __path__ property or as a __name__ property with
 * a naming convetion: *{amqp: {name: 'my-plugin'}}* will be resolved to the
 * npm module *deepstream.io/connection-my-plugin*
 * Exception: the name *uws* will be resolved to deepstream.io's internal uWebSockets plugin
 * Options to the constructor of the plugin can be passed as *options* object.
 *
 * CLI arguments will be considered.
 */
function handleConnectionEndpoints (config: DeepstreamConfig, services: any): DeepstreamConnectionEndpoint[] {
  // delete any endpoints that have been set to `null`
  for (const type in config.connectionEndpoints) {
    if (config.connectionEndpoints[type] === null) {
      delete config.connectionEndpoints[type]
    }
  }
  if (!config.connectionEndpoints || Object.keys(config.connectionEndpoints).length === 0) {
    throw new Error('No connection endpoints configured')
  }

  if (
    config.connectionEndpoints.find((connectionEndpoint) => connectionEndpoint.type === 'uws-websocket')
    && config.connectionEndpoints.find((connectionEndpoint) => connectionEndpoint.type === 'ws-websocket')
  ) {
    config.connectionEndpoints = config.connectionEndpoints.filter((endpoint) => endpoint.type !== 'uws-websocket')
  }

  const connectionEndpoints: DeepstreamConnectionEndpoint[] = []
  for (const plugin of config.connectionEndpoints) {
    plugin.options = plugin.options || {}

    let PluginConstructor
    if (plugin.type === 'ws-text') {
      PluginConstructor = WSTextConnectionEndpoint
    } else if (plugin.type === 'ws-json') {
      PluginConstructor = WSJSONConnectionEndpoint
    } else if (plugin.type === 'mqtt') {
      PluginConstructor = MQTTConnectionEndpoint
    } else if (plugin.type === 'uws-websocket') {
      PluginConstructor = UWSConnectionEndpoint
    } else if (plugin.type === 'ws-websocket') {
      PluginConstructor = WSConnectionEndpoint
    } else if (plugin.type === 'node-http') {
      PluginConstructor = HTTPConnectionEndpoint
    } else {
      PluginConstructor = resolvePluginClass(plugin, 'connection', config.logLevel)
    }

    connectionEndpoints.push(new PluginConstructor(plugin.options, services, config))
  }
  return connectionEndpoints
}

/**
 * Instantiate the given plugin, which either needs a path property or a name
 * property which fits to the npm module name convention. Options will be passed
 * to the constructor.
 *
 * CLI arguments will be considered.
 */
function resolvePluginClass (plugin: PluginConfig, type: string, logLevel: LOG_LEVEL): any {
  if (customPlugins.has(plugin.name)) {
    return customPlugins.get(plugin.name)
  }

  // Required for bundling via nexe
  const req = require
  let requirePath
  let pluginConstructor
  let es6Adaptor
  if (plugin.path != null) {
    requirePath = fileUtils.lookupLibRequirePath(plugin.path)
    es6Adaptor = req(requirePath)
    pluginConstructor = es6Adaptor.default ? es6Adaptor.default : es6Adaptor
  } else if (plugin.name != null && type) {
    try {
      requirePath = fileUtils.lookupLibRequirePath(`@deepstream/${type.toLowerCase()}-${plugin.name.toLowerCase()}`)
      es6Adaptor = req(requirePath)
    } catch (firstError) {
      const firstPath = requirePath
      try {
        requirePath = fileUtils.lookupLibRequirePath(`deepstream.io-${type.toLowerCase()}-${plugin.name.toLowerCase()}`)
        es6Adaptor = req(requirePath)
      } catch (secondError) {
        if (Number(LOG_LEVEL[logLevel]) === LOG_LEVEL.DEBUG) {
          console.log(`Error loading module ${firstPath}: ${firstError}`)
          console.log(`Error loading module ${requirePath}: ${secondError}`)
        }
        throw new Error(`Cannot load module ${firstPath} or ${requirePath}`)
      }
    }
    pluginConstructor = es6Adaptor.default ? es6Adaptor.default : es6Adaptor
  } else if (plugin.name != null) {
    requirePath = fileUtils.lookupLibRequirePath(plugin.name)
    es6Adaptor = req(requirePath)
    pluginConstructor = es6Adaptor.default ? es6Adaptor.default : es6Adaptor
  } else if (plugin.type === 'default' && defaultPlugins.has(type as any)) {
    pluginConstructor = defaultPlugins.get(type as any)
  } else {
    throw new Error(`Neither name nor path property found for ${type}, plugin type: ${plugin.type}`)
  }
  return pluginConstructor
}

/**
 * Instantiates the authentication handler registered for *config.auth.type*
 *
 * CLI arguments will be considered.
 */
function handleAuthStrategy (config: DeepstreamConfig, services: DeepstreamServices): DeepstreamAuthentication {
  let AuthenticationHandlerClass

  const authStrategies = {
    none: OpenAuthentication,
    file: FileBasedAuthentication,
    http: HttpAuthentication,
    storage: StorageBasedAuthentication
  }

  if (!config.auth) {
    throw new Error('No authentication type specified')
  }

  if (commandLineArguments.disableAuth) {
    config.auth.type = 'none'
    config.auth.options = {}
  }

  if (config.auth.name || config.auth.path) {
    AuthenticationHandlerClass = resolvePluginClass(config.auth, 'authentication', config.logLevel)
    if (!AuthenticationHandlerClass) {
      throw new Error(`unable to resolve authentication handler ${config.auth.name || config.auth.path}`)
    }
  } else if (config.auth.type && (authStrategies as any)[config.auth.type]) {
    AuthenticationHandlerClass = (authStrategies as any)[config.auth.type]
  } else {
    throw new Error(`Unknown authentication type ${config.auth.type}`)
  }

  return new AuthenticationHandlerClass(config.auth.options, services, config)
}

/**
 * Instantiates the permission handler registered for *config.permission.type*
 *
 * CLI arguments will be considered.
 */
function handlePermissionStrategy (config: DeepstreamConfig, services: DeepstreamServices): DeepstreamPermission {
  let PermissionHandlerClass

  const permissionStrategies = {
    config: ConfigPermission,
    none: OpenPermission
  }

  if (!config.permission) {
    throw new Error('No permission type specified')
  }

  if (commandLineArguments.disablePermissions) {
    config.permission.type = 'none'
    config.permission.options = {}
  }

  if (config.permission.name || config.permission.path) {
    PermissionHandlerClass = resolvePluginClass(config.permission, 'permission', config.logLevel)
    if (!PermissionHandlerClass) {
      throw new Error(`unable to resolve plugin ${config.permission.name || config.permission.path}`)
    }
  } else if (config.permission.type && (permissionStrategies as any)[config.permission.type]) {
    PermissionHandlerClass = (permissionStrategies as any)[config.permission.type]
  } else {
    throw new Error(`Unknown permission type ${config.permission.type}`)
  }

  return new PermissionHandlerClass(config.permission.options, services, config)
}

function handleMonitoring (config: DeepstreamConfig, services: DeepstreamServices): DeepstreamMonitoring {
  let MonitoringClass

  const monitoringPlugins = {
    default: NoopMonitoring,
    none: NoopMonitoring,
    http: HTTPMonitoring
  }

  if (config.monitoring.name || config.monitoring.path) {
    return new (resolvePluginClass(config.monitoring, 'monitoring', config.logLevel))(config.monitoring.options, services, config)
  } else if (config.monitoring.type && (monitoringPlugins as any)[config.monitoring.type]) {
    MonitoringClass = (monitoringPlugins as any)[config.monitoring.type]
  } else {
    throw new Error(`Unknown monitoring type ${config.monitoring.type}`)
  }

  return new MonitoringClass(config.monitoring.options, services, config)
}
