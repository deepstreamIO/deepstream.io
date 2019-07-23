import * as utils from '../utils/utils'
import * as fileUtils from './file-utils'
import { DeepstreamConfig, DeepstreamServices, DeepstreamConnectionEndpoint, PluginConfig, DeepstreamLogger, DeepstreamAuthentication, DeepstreamPermission, LOG_LEVEL, EVENT } from '../../ds-types/src/index'
import { DistributedClusterRegistry } from '../services/cluster-registry/distributed-cluster-registry'
import { SingleClusterNode } from '../services/cluster-node/single-cluster-node'
import { DefaultSubscriptionRegistryFactory } from '../services/subscription-registry/default-subscription-registry-factory'
import { HTTPConnectionEndpoint } from '../connection-endpoint/http/connection-endpoint'
import { OpenAuthentication } from '../services/authentication/open/open-authentication'
import { ConfigPermission } from '../services/permission/valve/config-permission'
import { OpenPermission } from '../services/permission/open/open-permission'
import { UWSConnectionEndpoint } from '../connection-endpoint/uws/connection-endpoint'
import { WSConnectionEndpoint } from '../connection-endpoint/ws/connection-endpoint'
import { FileBasedAuthentication } from '../services/authentication/file/file-based-authentication'
import { HttpAuthentication } from '../services/authentication/http/http-authentication'
import { NoopStorage } from '../services/storage/noop-storage'
import { LocalCache } from '../services/cache/local-cache'
import { StdOutLogger } from '../services/logger/std-out-logger'
import { LocalMonitoring } from '../services/monitoring/noop-monitoring'
import { DistributedLockRegistry } from '../services/lock/distributed-lock-registry'
import { DistributedStateRegistryFactory } from '../services/cluster-state/distributed-state-registry-factory'
import { get as getDefaultOptions } from '../default-options'
import Deepstream from '../deepstream.io'

let commandLineArguments: any

const customPlugins = new Map()

const defaultPlugins = new Map<keyof DeepstreamServices, any>([
  ['cache', LocalCache],
  ['storage', NoopStorage],
  ['logger', StdOutLogger],
  ['monitoring', LocalMonitoring],
  ['locks', DistributedLockRegistry],
  ['subscriptions', DefaultSubscriptionRegistryFactory],
  ['clusterRegistry', DistributedClusterRegistry],
  ['clusterStates', DistributedStateRegistryFactory],
  ['clusterNode', SingleClusterNode]
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

  services.subscriptions = new (resolvePluginClass(config.subscriptions, 'subscriptions'))(config.subscriptions.options, services, config)
  services.storage = new (resolvePluginClass(config.storage, 'storage'))(config.storage.options, services, config)
  services.cache = new (resolvePluginClass(config.cache, 'cache'))(config.cache.options, services, config)
  services.monitoring = new (resolvePluginClass(config.monitoring, 'monitoring'))(config.monitoring.options, services, config)
  services.authentication = handleAuthStrategy(config, services)
  services.permission = handlePermissionStrategy(config, services)
  services.connectionEndpoints = handleConnectionEndpoints(config, services)
  services.locks = new (resolvePluginClass(config.locks, 'locks'))(config.locks.options, services, config)
  services.clusterNode = new (resolvePluginClass(config.clusterNode, 'clusterNode'))(config.clusterNode.options, services, config)
  services.clusterRegistry = new (resolvePluginClass(config.clusterRegistry, 'clusterRegistry'))(config.clusterRegistry.options, services, config)
  services.clusterStates = new (resolvePluginClass(config.clusterStates, 'clusterStates'))(config.clusterStates.options, services, config)

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
    LoggerClass = resolvePluginClass(config.logger, 'logger')
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
      const PluginConstructor = resolvePluginClass(plugin, key)
      services.plugins[key] = new PluginConstructor(plugin.options)
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
    if (plugin.type === 'uws-websocket') {
      PluginConstructor = UWSConnectionEndpoint
    } else if (plugin.type === 'ws-websocket') {
      PluginConstructor = WSConnectionEndpoint
    } else if (plugin.type === 'node-http') {
      PluginConstructor = HTTPConnectionEndpoint
    } else {
      PluginConstructor = resolvePluginClass(plugin, 'connection')
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
function resolvePluginClass (plugin: PluginConfig, type: any): any {
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
      requirePath = fileUtils.lookupLibRequirePath(`@deepstream/${type}-${plugin.name}`)
      es6Adaptor = req(requirePath)
    } catch (e) {
      throw new Error(`Cannot find module ${requirePath}`)
    }
    pluginConstructor = es6Adaptor.default ? es6Adaptor.default : es6Adaptor
  } else if (plugin.name != null) {
    requirePath = fileUtils.lookupLibRequirePath(plugin.name)
    es6Adaptor = req(requirePath)
    pluginConstructor = es6Adaptor.default ? es6Adaptor.default : es6Adaptor
  } else if (plugin.type === 'default' && defaultPlugins.has(type)) {
    pluginConstructor = defaultPlugins.get(type)
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
  }

  if (!config.auth) {
    throw new Error('No authentication type specified')
  }

  if (commandLineArguments.disableAuth) {
    config.auth.type = 'none'
    config.auth.options = {}
  }

  if (config.auth.name || config.auth.path) {
    AuthenticationHandlerClass = resolvePluginClass(config.auth, 'authentication')
    if (!AuthenticationHandlerClass) {
      throw new Error(`unable to resolve authentication handler ${config.auth.name || config.auth.path}`)
    }
  } else if (config.auth.type && (authStrategies as any)[config.auth.type]) {
    AuthenticationHandlerClass = (authStrategies as any)[config.auth.type]
  } else {
    throw new Error(`Unknown authentication type ${config.auth.type}`)
  }

  if (config.auth.options && config.auth.options.path) {
    config.auth.options.path = fileUtils.lookupConfRequirePath(config.auth.options.path)
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
    PermissionHandlerClass = resolvePluginClass(config.permission, 'permission')
    if (!PermissionHandlerClass) {
      throw new Error(`unable to resolve plugin ${config.permission.name || config.permission.path}`)
    }
  } else if (config.permission.type && (permissionStrategies as any)[config.permission.type]) {
    PermissionHandlerClass = (permissionStrategies as any)[config.permission.type]
  } else {
    throw new Error(`Unknown permission type ${config.permission.type}`)
  }

  if (config.permission.options && config.permission.options.path) {
    config.permission.options.path = fileUtils.lookupConfRequirePath(config.permission.options.path)
  }

  if (config.permission.type === 'config') {
    return new PermissionHandlerClass(config.permission.options, services, config)
  } else {
    return new PermissionHandlerClass(config.permission.options, services, config)
  }
}
