import * as fs from 'fs'
import FileAuthenticationHandler from '../authentication/file-based-authentication-handler'
import OpenAuthenticationHandler from '../authentication/open-authentication-handler'
import HTTPAuthenticationHAndler from '../authentication/http-authentication-handler'
import { LOG_LEVEL } from '../constants'
import DefaultCache from '../default-plugins/local-cache'
import DefaultStorage from '../default-plugins/noop-storage'
import DefaultMonitoring from '../default-plugins/noop-monitoring'
import DefaultLogger from '../default-plugins/std-out-logger'
import HTTPConnectionEndpoint from '../message/http/connection-endpoint'
import UWSConnectionEndpoint from '../message/uws/connection-endpoint'
import ConfigPermissionHandler from '../permission/config-permission-handler'
import OpenPermissionHandler from '../permission/open-permission-handler'
import * as utils from '../utils/utils'
import * as fileUtils from './file-utils'
import { DeepstreamConfig, DeepstreamServices, ConnectionEndpoint, PluginConfig, Logger, Storage, StorageReadCallback, StorageWriteCallback, AuthenticationHandler, PermissionHandler } from '../types'
import { JSONObject } from '../../binary-protocol/src/message-constants'
import { DistributedLockRegistry } from '../cluster/distributed-lock-registry'
import { DistributedClusterRegistry } from '../cluster/distributed-cluster-registry'
import { DistributedStateRegistryFactory } from '../cluster/distributed-state-registry-factory'
import { SingleClusterNode } from '../cluster/single-cluster-node'
import { DefaultSubscriptionRegistryFactory } from '../utils/default-subscription-registry-factory';

let commandLineArguments: any

const customPlugins = new Map()

const defaultPlugins = new Map<string, any>([
  ['cache', DefaultCache],
  ['storage', DefaultStorage],
  ['logger', DefaultLogger],
  ['monitoring', DefaultMonitoring],
  ['message', SingleClusterNode],
  ['locks', DistributedLockRegistry],
  ['cluster', DistributedClusterRegistry],
  ['states', DistributedStateRegistryFactory],
  ['subscriptions', DefaultSubscriptionRegistryFactory]
])

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
export const initialise = function (config: DeepstreamConfig): { config: DeepstreamConfig, services: DeepstreamServices } {
  commandLineArguments = global.deepstreamCLI || {}
  handleUUIDProperty(config)
  handleSSLProperties(config)

  const services = {} as DeepstreamServices
  services.logger = handleLogger(config, services)

  services.subscriptions = new (resolvePluginClass(config.subscriptions, 'subscriptions'))(config.subscriptions.options, services, config)
  services.message = new (resolvePluginClass(config.cluster.message, 'message'))(config.cluster.message.options, services, config)
  services.storage = new (resolvePluginClass(config.storage, 'storage'))(config.storage.options, services, config)
  services.cache = new (resolvePluginClass(config.cache, 'cache'))(config.cache.options, services, config)
  services.monitoring = new (resolvePluginClass(config.monitoring, 'monitoring'))(config.monitoring.options, services, config)
  services.authenticationHandler = handleAuthStrategy(config, services)
  services.permissionHandler = handlePermissionStrategy(config, services)
  services.connectionEndpoints = handleConnectionEndpoints(config, services)
  services.locks = new (resolvePluginClass(config.cluster.locks, 'locks'))(config.cluster.locks.options, services, config)
  services.cluster = new (resolvePluginClass(config.cluster.registry, 'cluster'))(config.cluster.registry.options, services, config)
  services.states = new (resolvePluginClass(config.cluster.states, 'states'))(config.cluster.states.options, services, config)
  
  if (services.cache.apiVersion !== 2) {
    storageCompatability(services.cache)
  }
  if (services.storage.apiVersion !== 2) {
    storageCompatability(services.storage)
  }

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
 * Load the SSL files
 * CLI arguments will be considered.
 */
function handleSSLProperties (config: DeepstreamConfig): void {
  const sslFiles = ['sslKey', 'sslCert', 'sslCa']
  let key
  let resolvedFilePath
  let filePath
  for (let i = 0; i < sslFiles.length; i++) {
    key = sslFiles[i]
    filePath = (config as any)[key]
    if (!filePath) {
      continue
    }
    resolvedFilePath = fileUtils.lookupConfRequirePath(filePath)
    try {
      (config as any)[key] = fs.readFileSync(resolvedFilePath, 'utf8')
    } catch (e) {
      throw new Error(`The file path "${resolvedFilePath}" provided by "${key}" does not exist.`)
    }
  }
}

/**
 * Initialize the logger and overwrite the root logLevel if it's set
 * CLI arguments will be considered.
 */
function handleLogger (config: DeepstreamConfig, services: DeepstreamServices): Logger {
  const configOptions = (config.logger || {}).options
  if (commandLineArguments.colors !== undefined) {
    configOptions.colors = commandLineArguments.colors
  }
  let LoggerClass
  if (config.logger.type === 'default') {
    LoggerClass = DefaultLogger
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
 * npm module *deepstream.io-cache-redis*
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
 * npm module *deepstream.io-connection-my-plugin*
 * Exception: the name *uws* will be resolved to deepstream.io's internal uWebSockets plugin
 * Options to the constructor of the plugin can be passed as *options* object.
 *
 * CLI arguments will be considered.
 */
function handleConnectionEndpoints (config: DeepstreamConfig, services: any): ConnectionEndpoint[] {
  // delete any endpoints that have been set to `null`
  for (const type in config.connectionEndpoints) {
    if (!config.connectionEndpoints[type]) {
      delete config.connectionEndpoints[type]
    }
  }
  if (!config.connectionEndpoints || Object.keys(config.connectionEndpoints).length === 0) {
    throw new Error('No connection endpoints configured')
  }
  const connectionEndpoints: ConnectionEndpoint[] = []
  for (const connectionType in config.connectionEndpoints) {
    const plugin = config.connectionEndpoints[connectionType]

    plugin.options = plugin.options || {}

    let PluginConstructor
    if (plugin.type === 'default' && connectionType === 'websocket') {
      PluginConstructor = UWSConnectionEndpoint
    } else if (plugin.type === 'default' && connectionType === 'http') {
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
function resolvePluginClass (plugin: PluginConfig, type: string): any {
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
    requirePath = `deepstream.io-${type}-${plugin.name}`
    requirePath = fileUtils.lookupLibRequirePath(requirePath)
    es6Adaptor = req(requirePath)
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
function handleAuthStrategy (config: DeepstreamConfig, services: DeepstreamServices): AuthenticationHandler {
  let AuthenticationHandlerClass

  const authStrategies = {
    none: OpenAuthenticationHandler,
    file: FileAuthenticationHandler, // eslint-disable-line
    http: HTTPAuthenticationHAndler, // eslint-disable-line
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
function handlePermissionStrategy (config: DeepstreamConfig, services: DeepstreamServices): PermissionHandler {
  let PermissionHandlerClass

  const permissionStrategies = {
    config: ConfigPermissionHandler,
    none: OpenPermissionHandler,
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

export function storageCompatability (storage: Storage) {
  const oldGet = storage.get as Function
  storage.get = (recordName: string, callback: StorageReadCallback) => {
    oldGet.call(storage, recordName, (error: string | null, record: { _v: number, _d: JSONObject } | null) => {
      callback(error, record ? record._v : -1, record ? record._d : null)
    })
  }

  const oldSet = storage.set as Function
  storage.set = (recordName: string, version: number, data: any, callback: StorageWriteCallback) => {
    oldSet.call(storage, recordName, { _v: version, _d: data }, callback)
  }
}
