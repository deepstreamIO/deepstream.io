import * as fs from 'fs'
import FileAuthenticationHandler from '../authentication/file-based-authentication-handler'
import OpenAuthenticationHandler from '../authentication/open-authentication-handler'
import HTTPAuthenticationHAndler from '../authentication/http-authentication-handler'
import { LOG_LEVEL } from '../constants'
import DefaultCache from '../default-plugins/local-cache'
import DefaultStorage from '../default-plugins/noop-storage'
import DefaultLogger from '../default-plugins/std-out-logger'
import HTTPConnectionEndpoint from '../message/http/connection-endpoint'
import UWSConnectionEndpoint from '../message/uws/connection-endpoint'
import ConfigPermissionHandler from '../permission/config-permission-handler'
import OpenPermissionHandler from '../permission/open-permission-handler'
import * as utils from '../utils/utils'
import * as fileUtils from './file-utils'

let commandLineArguments

const customPlugins = new Map()

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
export const initialise = function (config: InternalDeepstreamConfig): { config: InternalDeepstreamConfig, services: DeepstreamServices } {
  commandLineArguments = global.deepstreamCLI || {}
  handleUUIDProperty(config)
  handleSSLProperties(config)

  const services: any = {
    registeredPlugins: ['authenticationHandler', 'permissionHandler', 'cache', 'storage'],
  }

  services.cache = new DefaultCache()
  services.storage = new DefaultStorage()

  services.logger = handleLogger(config)
  handlePlugins(config, services)
  services.authenticationHandler = handleAuthStrategy(config, services.logger)
  services.permissionHandler = handlePermissionStrategy(config, services)
  services.connectionEndpoints = handleConnectionEndpoints(config, services)

  if (services.cache.apiVersion !== 2) {
    storageCompatability(services.cache)
  }
  if (services.storage.apiVersion !== 2) {
    storageCompatability(services.storage)
  }

  return { config, services }
}

/**
 * Transform the UUID string config to a UUID in the config object.
 */
function handleUUIDProperty (config: InternalDeepstreamConfig): void {
  if (config.serverName === 'UUID') {
    config.serverName = utils.getUid()
  }
}

/**
 * Load the SSL files
 * CLI arguments will be considered.
 */
function handleSSLProperties (config: InternalDeepstreamConfig): void {
  const sslFiles = ['sslKey', 'sslCert', 'sslCa']
  let key
  let resolvedFilePath
  let filePath
  for (let i = 0; i < sslFiles.length; i++) {
    key = sslFiles[i]
    filePath = config[key]
    if (!filePath) {
      continue
    }
    resolvedFilePath = fileUtils.lookupConfRequirePath(filePath)
    try {
      config[key] = fs.readFileSync(resolvedFilePath, 'utf8')
    } catch (e) {
      throw new Error(`The file path "${resolvedFilePath}" provided by "${key}" does not exist.`)
    }
  }
}

/**
 * Initialize the logger and overwrite the root logLevel if it's set
 * CLI arguments will be considered.
 */
function handleLogger (config: InternalDeepstreamConfig): Logger {
  const configOptions = (config.logger || {}).options
  if (commandLineArguments.colors !== undefined) {
    configOptions.colors = commandLineArguments.colors
  }
  let Logger
  if (config.logger.type === 'default') {
    Logger = DefaultLogger
  } else {
    Logger = resolvePluginClass(config.logger, 'logger')
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
  const logger = new Logger(configOptions)
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
 * Allowed types: {cache|storage}
 * Plugins can be passed either as a __path__ property or as a __name__ property with
 * a naming convetion: *{cache: {name: 'redis'}}* will be resolved to the
 * npm module *deepstream.io-cache-redis*
 * Options to the constructor of the plugin can be passed as *options* object.
 *
 * CLI arguments will be considered.
 */
function handlePlugins (config: InternalDeepstreamConfig, services: any): void {
  if (config.plugins == null) {
    return
  }
  const plugins = Object.assign({}, config.plugins)

  for (const key in plugins) {
    const plugin = plugins[key]
    if (plugin) {
      const PluginConstructor = resolvePluginClass(plugin, key)
      services[key] = new PluginConstructor(plugin.options)
      if (services.registeredPlugins.indexOf(key) === -1) {
        services.registeredPlugins.push(key)
      }
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
function handleConnectionEndpoints (config: InternalDeepstreamConfig, services: any): Array<ConnectionEndpoint> {
  // delete any endpoints that have been set to `null`
  for (const type in config.connectionEndpoints) {
    if (!config.connectionEndpoints[type]) {
      delete config.connectionEndpoints[type]
    }
  }
  if (!config.connectionEndpoints || Object.keys(config.connectionEndpoints).length === 0) {
    throw new Error('No connection endpoints configured')
  }
  const connectionEndpoints: Array<ConnectionEndpoint> = []
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
    connectionEndpoints.push(new PluginConstructor(plugin.options, services))
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

  // nexe needs *global.require* for __dynamic__ modules
  // but browserify and proxyquire can't handle *global.require*
  const req = global && global.require ? global.require : require
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
  } else if (plugin.type === 'default' && type === 'cache') {
    pluginConstructor = DefaultCache
  } else if (plugin.type === 'default' && type === 'storage') {
    pluginConstructor = DefaultStorage
  } else {
    throw new Error(`Neither name nor path property found for ${type}`)
  }
  return pluginConstructor
}

/**
 * Instantiates the authentication handler registered for *config.auth.type*
 *
 * CLI arguments will be considered.
 */
function handleAuthStrategy (config: InternalDeepstreamConfig, logger: Logger): AuthenticationHandler {
  let AuthenticationHandler

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
    AuthenticationHandler = resolvePluginClass(config.auth, 'authentication')
    if (!AuthenticationHandler) {
      throw new Error(`unable to resolve authentication handler ${config.auth.name || config.auth.path}`)
    }
  } else if (config.auth.type && authStrategies[config.auth.type]) {
    AuthenticationHandler = authStrategies[config.auth.type]
  } else {
    throw new Error(`Unknown authentication type ${config.auth.type}`)
  }

  if (config.auth.options) {
    if (config.auth.options.path) {
      config.auth.options.path = fileUtils.lookupConfRequirePath(config.auth.options.path)
    }
    ['cert', 'key'].forEach(sslOption => {
      if (config.auth.options[sslOption]) {
        config.auth.options[sslOption] = fileUtils.lookupConfRequirePath(config.auth.options[sslOption])
        config.auth.options[sslOption] = fs.readFileSync(config.auth.options[sslOption], 'utf8')
      }
    })
    if (config.auth.options.pfx) {
      config.auth.options.pfx = fileUtils.lookupConfRequirePath(config.auth.options.pfx)
      config.auth.options.pfx = fs.readFileSync(config.auth.options.pfx)
    }
    const caOption = config.auth.options.ca
    if (caOption) {
      const caOptionArr = Array.isArray(caOption) ? caOption : [caOption]
      config.auth.options.ca = caOptionArr.map(caFile => {
        const caFilePath = fileUtils.lookupConfRequirePath(caFile)
        return fs.readFileSync(caFilePath, 'utf8')
      })
    }
  }

  return new AuthenticationHandler(config.auth.options, logger)
}

/**
 * Instantiates the permission handler registered for *config.permission.type*
 *
 * CLI arguments will be considered.
 */
function handlePermissionStrategy (config: InternalDeepstreamConfig, services: any): PermissionHandler {
  let PermissionHandler

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
    PermissionHandler = resolvePluginClass(config.permission, 'permission')
    if (!PermissionHandler) {
      throw new Error(`unable to resolve plugin ${config.permission.name || config.permission.path}`)
    }
  } else if (config.permission.type && permissionStrategies[config.permission.type]) {
    PermissionHandler = permissionStrategies[config.permission.type]
  } else {
    throw new Error(`Unknown permission type ${config.permission.type}`)
  }

  if (config.permission.options && config.permission.options.path) {
    config.permission.options.path = fileUtils.lookupConfRequirePath(config.permission.options.path)
  }

  if (config.permission.type === 'config') {
    return new PermissionHandler(config, services)
  } else {
    return new PermissionHandler(config.permission.options, services)
  }

}

export function storageCompatability (storage: StoragePlugin) {
  const oldGet = storage.get as Function
  storage.get = (recordName: string, callback: StorageReadCallback) => {
    oldGet.call(storage, recordName, (error, record) => {
      callback(error, record ? record._v : -1, record ? record._d : {})
    })
  }

  const oldSet = storage.set as Function
  storage.set = (recordName: string, version: number, data: any, callback: StorageWriteCallback) => {
    oldSet.call(storage, recordName, { _v: version, _d: data }, callback)
  }
}
