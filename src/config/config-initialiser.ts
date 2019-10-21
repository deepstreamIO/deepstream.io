import * as utils from '../utils/utils'
import * as fileUtils from './file-utils'
import { DeepstreamConfig, DeepstreamServices, DeepstreamConnectionEndpoint, PluginConfig, DeepstreamLogger, DeepstreamAuthentication, DeepstreamPermission, LOG_LEVEL, EVENT, DeepstreamMonitoring, DeepstreamAuthenticationCombiner, DeepstreamHTTPService } from '../../ds-types/src/index'
import { DistributedClusterRegistry } from '../services/cluster-registry/distributed-cluster-registry'
import { SingleClusterNode } from '../services/cluster-node/single-cluster-node'
import { DefaultSubscriptionRegistryFactory } from '../services/subscription-registry/default-subscription-registry-factory'
import { HTTPConnectionEndpoint } from '../connection-endpoint/http/connection-endpoint'
import { CombineAuthentication } from '../services/authentication/combine/combine-authentication'
import { OpenAuthentication } from '../services/authentication/open/open-authentication'
import { ConfigPermission } from '../services/permission/valve/config-permission'
import { OpenPermission } from '../services/permission/open/open-permission'
import { WSBinaryConnectionEndpoint } from '../connection-endpoint/websocket/binary/connection-endpoint'
import { WSTextConnectionEndpoint } from '../connection-endpoint/websocket/text/connection-endpoint'
import { WSJSONConnectionEndpoint } from '../connection-endpoint/websocket/json/connection-endpoint'
import { MQTTConnectionEndpoint } from '../connection-endpoint/mqtt/connection-endpoint'
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
  services.monitoring = handleMonitoring(config, services)
  services.subscriptions = new (resolvePluginClass(config.subscriptions, 'subscriptions', ll))(config.subscriptions.options, services, config)
  services.storage = new (resolvePluginClass(config.storage, 'storage', ll))(config.storage.options, services, config)
  services.cache = new (resolvePluginClass(config.cache, 'cache', ll))(config.cache.options, services, config)
  services.authentication = handleAuthStrategies(config, services)
  services.permission = handlePermissionStrategies(config, services)
  services.connectionEndpoints = handleConnectionEndpoints(config, services)
  services.locks = new (resolvePluginClass(config.locks, 'locks', ll))(config.locks.options, services, config)
  services.clusterNode = new (resolvePluginClass(config.clusterNode, 'clusterNode', ll))(config.clusterNode.options, services, config)
  services.clusterRegistry = new (resolvePluginClass(config.clusterRegistry, 'clusterRegistry', ll))(config.clusterRegistry.options, services, config)
  services.clusterStates = new (resolvePluginClass(config.clusterStates, 'clusterStates', ll))(config.clusterStates.options, services, config)
  services.httpService = handleHTTPServer(config, services)

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

  const connectionEndpoints: DeepstreamConnectionEndpoint[] = []
  for (const plugin of config.connectionEndpoints) {
    plugin.options = plugin.options || {}

    let PluginConstructor
    if (plugin.type === 'ws-binary') {
      PluginConstructor = WSBinaryConnectionEndpoint
    } else if (plugin.type === 'ws-text') {
      PluginConstructor = WSTextConnectionEndpoint
    } else if (plugin.type === 'ws-json') {
      PluginConstructor = WSJSONConnectionEndpoint
    } else if (plugin.type === 'mqtt') {
      PluginConstructor = MQTTConnectionEndpoint
    } else if (plugin.type === 'http') {
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
 * Instantiates the authentication handlers registered for *config.auth.type*
 *
 * CLI arguments will be considered.
 */
function handleAuthStrategies (config: DeepstreamConfig, services: DeepstreamServices): DeepstreamAuthenticationCombiner {
  if (commandLineArguments.disableAuth) {
    config.auth = [{
      type: 'none',
      options: {}
    }]
  }

  if (!config.auth) {
    throw new Error('No authentication type specified')
  }

  return new CombineAuthentication(config.auth.map((auth) => handleAuthStrategy(auth, config, services)))
}

/**
 * Instantiates the authentication handler registered for *config.auth.type*
 *
 * CLI arguments will be considered.
 */
function handleAuthStrategy (auth: PluginConfig, config: DeepstreamConfig, services: DeepstreamServices): DeepstreamAuthentication {
  let AuthenticationHandlerClass

  const authStrategies = {
    none: OpenAuthentication,
    file: FileBasedAuthentication,
    http: HttpAuthentication,
    storage: StorageBasedAuthentication
  }

  if (auth.name || auth.path) {
    AuthenticationHandlerClass = resolvePluginClass(auth, 'authentication', config.logLevel)
    if (!AuthenticationHandlerClass) {
      throw new Error(`unable to resolve authentication handler ${auth.name || auth.path}`)
    }
  } else if (auth.type && (authStrategies as any)[auth.type]) {
    AuthenticationHandlerClass = (authStrategies as any)[auth.type]
  } else {
    throw new Error(`Unknown authentication type ${auth.type}`)
  }

  return new AuthenticationHandlerClass(auth.options, services, config)
}

/**
 * Instantiates the permission handler registered for *config.permission.type*
 *
 * CLI arguments will be considered.
 */
function handlePermissionStrategies (config: DeepstreamConfig, services: DeepstreamServices): DeepstreamPermission {
  const permission = config.permission

  if (!config.permission) {
    throw new Error('No permission type specified')
  }

  if (commandLineArguments.disablePermissions) {
    config.permission.type = 'none'
    config.permission.options = {}
  }

  let PermissionHandlerClass

  const permissionStrategies = {
    config: ConfigPermission,
    none: OpenPermission
  }

  if (permission.name || permission.path) {
    PermissionHandlerClass = resolvePluginClass(permission, 'permission', config.logLevel)
    if (!PermissionHandlerClass) {
      throw new Error(`unable to resolve plugin ${permission.name || permission.path}`)
    }
  } else if (permission.type && (permissionStrategies as any)[permission.type]) {
    PermissionHandlerClass = (permissionStrategies as any)[permission.type]
  } else {
    throw new Error(`Unknown permission type ${permission.type}`)
  }

  return new PermissionHandlerClass(permission.options, services, config)
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

function handleHTTPServer (config: DeepstreamConfig, services: DeepstreamServices): DeepstreamHTTPService {
  let HttpServerClass

  const httpPlugins = {
    default: NodeHTTP
  }

  if (commandLineArguments.host) {
    config.httpServer.options.host = commandLineArguments.host
  }

  if (commandLineArguments.port) {
    config.httpServer.options.port = commandLineArguments.port
  }

  if (config.httpServer.name || config.httpServer.path) {
    return new (resolvePluginClass(config.httpServer, 'httpServer', config.logLevel))(config.httpServer.options, services, config)
  } else if (config.httpServer.type && (httpPlugins as any)[config.httpServer.type]) {
    HttpServerClass = (httpPlugins as any)[config.httpServer.type]
  } else if (config.httpServer.type === 'uws') {
    try {
      const { UWSHTTP } = require('../services/http/uws/uws-http')
      HttpServerClass = UWSHTTP
    } catch (e) {
      console.error('Error loading uws http service, this is most likely due to uWebsocket.js not being supported on this platform')
      process.exit(1)
    }
  } else {
    throw new Error(`Unknown httpServer type ${config.httpServer.type}`)
  }

  return new HttpServerClass(config.httpServer.options, services, config)
}
