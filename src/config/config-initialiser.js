'use strict'

const DefaultLogger = require('../default-plugins/std-out-logger')
const fs = require('fs')
const utils = require('../utils/utils')
const C = require('../constants/constants')
const fileUtils = require('./file-utils')

const LOG_LEVEL_KEYS = Object.keys(C.LOG_LEVEL)

let commandLineArguments

/**
 * Takes a configuration object and instantiates functional properties.
 * CLI arguments will be considered.
 *
 * @param   {Object} config configuration
 *
 * @returns {Object} configuration
 */
exports.initialise = function (config) {
  commandLineArguments = global.deepstreamCLI || {}

  // The default plugins required by deepstream to run
  config.pluginTypes = [
    'messageConnector',
    'storage',
    'cache',
    'authenticationHandler',
    'permissionHandler'
  ]

  handleUUIDProperty(config)
  handleSSLProperties(config)
  handleLogger(config)
  handlePlugins(config)
  handleConnectionEndpoints(config)
  handleAuthStrategy(config)
  handlePermissionStrategy(config)

  return config
}

/**
 * Transform the UUID string config to a UUID in the config object.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleUUIDProperty (config) {
  if (config.serverName === 'UUID') {
    config.serverName = utils.getUid()
  }
}

/**
 * Load the SSL files
 * CLI arguments will be considered.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleSSLProperties (config) {
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
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleLogger (config) {
  const configOptions = (config.logger || {}).options
  let Logger
  if (config.logger == null || config.logger.name === 'default') {
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

  config.logger = new Logger(configOptions)
  if (LOG_LEVEL_KEYS.indexOf(config.logLevel) !== -1) {
    // NOTE: config.logLevel has highest priority, compare to the level defined
    // in the nested logger object
    config.logLevel = C.LOG_LEVEL[config.logLevel]
    config.logger.setLogLevel(config.logLevel)
  }
}

/**
 * Handle the plugins property in the config object the connectors.
 * Allowed types: {message|cache|storage}
 * Plugins can be passed either as a __path__ property or as a __name__ property with
 * a naming convetion: *{cache: {name: 'redis'}}* will be resolved to the
 * npm module *deepstream.io-cache-redis*
 * Exception: *message* will be resolved to *msg*
 * Options to the constructor of the plugin can be passed as *options* object.
 *
 * CLI arguments will be considered.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handlePlugins (config) {
  if (config.plugins == null) {
    return
  }
  // mapping between the root properties which contains the plugin instance
  // and the plugin configuration objects
  const connectorMap = {
    messageConnector: 'message',
    cache: 'cache',
    storage: 'storage'
  }
  // mapping between the plugin configuration properties and the npm module
  // name resolution
  const typeMap = {
    message: 'msg',
    cache: 'cache',
    storage: 'storage'
  }
  const plugins = Object.assign({}, config.plugins, {
    messageConnector: config.plugins.message
  })
  delete plugins.message

  for (const key in plugins) {
    const plugin = plugins[key]
    if (plugin) {
      const PluginConstructor = resolvePluginClass(plugin, typeMap[connectorMap[key]])
      config[key] = new PluginConstructor(plugin.options)
      if (config.pluginTypes.indexOf(key) === -1) {
        config.pluginTypes.push(key)
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
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleConnectionEndpoints (config) {
  if (!config.connectionEndpoints || Object.keys(config.connectionEndpoints).length === 0) {
    throw new Error('No connection endpoints configured')
  }
  if (Object.keys(config.connectionEndpoints).length > 1) {
    throw new Error('Currently only one connection endpoint may be configured')
  }
  const connectionEndpoints = []
  for (const connectionType in config.connectionEndpoints) {
    const plugin = config.connectionEndpoints[connectionType]

    plugin.options = plugin.options || {}

    // use global options unless provided in plugin options
    plugin.options.port = plugin.options.port || config.port
    plugin.options.host = plugin.options.host || config.host
    plugin.options.urlPath = plugin.options.urlPath || config.urlPath
    plugin.options.pingInterval = plugin.options.pingInterval || config.heartbeatInterval
    plugin.options.externalUrl = plugin.options.externalUrl || config.externalUrl
    plugin.options.healthCheckPath = plugin.options.healthCheckPath || config.healthCheckPath
    plugin.options.unauthenticatedClientTimeout =
      plugin.options.unauthenticatedClientTimeout || config.unauthenticatedClientTimeout
    plugin.options.sslKey = plugin.options.sslKey || config.sslKey
    plugin.options.sslCert = plugin.options.sslCert || config.sslCert
    plugin.options.sslCa = plugin.options.sslCa || config.sslCa

    let PluginConstructor
    if (plugin.name === 'uws') {
      PluginConstructor = require('../message/uws-connection-endpoint')
    } else {
      PluginConstructor = resolvePluginClass(plugin, 'connection')
    }
    connectionEndpoints.push(new PluginConstructor(plugin.options))
  }
  config.connectionEndpoints = connectionEndpoints
}

/**
 * Instantiate the given plugin, which either needs a path property or a name
 * property which fits to the npm module name convention. Options will be passed
 * to the constructor.
 *
 * CLI arguments will be considered.
 *
 * @param {Object} config deepstream configuration object
 *
 * @private
 * @returns {Function} Instance return be the plugin constructor
 */
function resolvePluginClass (plugin, type) {
  // nexe needs *global.require* for __dynamic__ modules
  // but browserify and proxyquire can't handle *global.require*
  const req = global && global.require ? global.require : require
  let requirePath
  let pluginConstructor
  if (plugin.path != null) {
    requirePath = fileUtils.lookupLibRequirePath(plugin.path)
    pluginConstructor = req(requirePath)
  } else if (plugin.name != null && type) {
    requirePath = `deepstream.io-${type}-${plugin.name}`
    requirePath = fileUtils.lookupLibRequirePath(requirePath)
    pluginConstructor = req(requirePath)
  } else if (plugin.name != null) {
    requirePath = fileUtils.lookupLibRequirePath(plugin.name)
    pluginConstructor = req(requirePath)
  } else {
    throw new Error(`Neither name nor path property found for ${type}`)
  }
  return pluginConstructor
}

/**
 * Instantiates the authentication handler registered for *config.auth.type*
 *
 * CLI arguments will be considered.
 *
 * @param   {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handleAuthStrategy (config) {
  const authStrategies = {
    none: require('../authentication/open-authentication-handler'), // eslint-disable-line
    file: require('../authentication/file-based-authentication-handler'), // eslint-disable-line
    http: require('../authentication/http-authentication-handler') // eslint-disable-line
  }

  if (!config.auth) {
    throw new Error('No authentication type specified')
  }

  if (commandLineArguments.disableAuth) {
    config.auth.type = 'none'
    config.auth.options = {}
  }

  if (!authStrategies[config.auth.type] && !config.auth.path) {
    throw new Error(`Unknown authentication type ${config.auth.type}`)
  }

  if (config.auth.options && config.auth.options.path) {
    config.auth.options.path = fileUtils.lookupConfRequirePath(config.auth.options.path)
  }

  config.authenticationHandler =
    new (authStrategies[config.auth.type])(config.auth.options, config.logger)
}

/**
 * Instantiates the permission handler registered for *config.permission.type*
 *
 * CLI arguments will be considered.
 *
 * @param   {Object} config deepstream configuration object
 *
 * @private
 * @returns {void}
 */
function handlePermissionStrategy (config) {
  const permissionStrategies = {
    config: require('../permission/config-permission-handler'), // eslint-disable-line
    none: require('../permission/open-permission-handler') // eslint-disable-line
  }

  if (!config.permission) {
    throw new Error('No permission type specified')
  }

  if (commandLineArguments.disablePermissions) {
    config.permission.type = 'none'
    config.permission.options = {}
  }

  if (!permissionStrategies[config.permission.type] && !config.permission.path) {
    throw new Error(`Unknown permission type ${config.permission.type}`)
  }

  if (config.permission.options && config.permission.options.path) {
    config.permission.options.path = fileUtils.lookupConfRequirePath(config.permission.options.path)
  }

  config.permissionHandler = new (permissionStrategies[config.permission.type])(config)
}
