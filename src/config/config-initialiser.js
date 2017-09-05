'use strict'

const DefaultLogger = require('../default-plugins/std-out-logger')
const fs = require('fs')
const crypto = require('crypto')
const utils = require('../utils/utils')
const C = require('../constants/constants')
const fileUtils = require('./file-utils')
const UWSConnectionEndpoint = require('../message/uws/connection-endpoint')
const HTTPConnectionEndpoint = require('../message/http/connection-endpoint')

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
    'storage',
    'cache',
    'authenticationHandler',
    'permissionHandler'
  ]

  handleLicenseKey(config)
  handleUUIDProperty(config)
  handleSSLProperties(config)
  handleLogger(config)
  handlePlugins(config)
  handleConnectionEndpoints(config)
  handleAuthStrategy(config)
  handlePermissionStrategy(config)

  return config
}

function handleLicenseKey (config) {
  if (!config.licenseKey) {
    throw new Error('No license key configured. ')
  }
  const pubkey = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvrpbVcfVaE9TbFdaY0Wz\nSjgNLnR7raKuwuiEdZpDCW1u7JdiQ0WSZuU1+O346Kwo6cKkP6N7AP/LQOl5yHd+\n22+shFvXy0bEeeWC0/txSJGFiqjIQxkQgvubS27qY8WgLfKHm+l9O7YF3Sqz//TL\nWLZRLOt25myBBHtjheca28vz3+PxADX++3WFuOGubtrA6sAM9+rJx79u4+9te6vN\nnCDzeiEdvLgOQlO8d2I0moeMC9Ipe5DYLXReiygUKATR8dXHr8i12cCXBzymZCuB\nX+Yu1ZprYFcf1wmt/w3iAblaXBZnRCCZdOe6snKlJtFkTpxK0XZa4K8UOUW2KS7+\n/wIDAQAB\n-----END PUBLIC KEY-----\n'
  const rawLicenseInfo = crypto.publicDecrypt(pubkey, Buffer.from(config.licenseKey, 'base64'))
  let organization
  let maxNodes
  try {
    const licenseInfo = JSON.parse(rawLicenseInfo)
    organization = licenseInfo.org
    maxNodes = licenseInfo.maxNodes
  } catch (err) {
    throw new Error('Invalid license key provided. Please contact info@deepstreamhub.com.')
  }
  config.organization = organization
  config.maxNodes = maxNodes
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
 * Allowed types: {cache|storage}
 * Plugins can be passed either as a __path__ property or as a __name__ property with
 * a naming convetion: *{cache: {name: 'redis'}}* will be resolved to the
 * npm module *deepstream.io-cache-redis*
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
    cache: 'cache',
    storage: 'storage',
    monitoring: 'monitoring'
  }
  // mapping between the plugin configuration properties and the npm module
  // name resolution
  const typeMap = {
    cache: 'cache',
    storage: 'storage',
    monitoring: 'monitoring'
  }
  const plugins = Object.assign({}, config.plugins)

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
  // delete any endpoints that have been set to `null`
  for (const type in config.connectionEndpoints) {
    if (!config.connectionEndpoints[type]) {
      delete config.connectionEndpoints[type]
    }
  }
  if (!config.connectionEndpoints || Object.keys(config.connectionEndpoints).length === 0) {
    throw new Error('No connection endpoints configured')
  }
  const connectionEndpoints = []
  for (const connectionType in config.connectionEndpoints) {
    const plugin = config.connectionEndpoints[connectionType]

    plugin.options = plugin.options || {}

    let PluginConstructor
    if (plugin.name === 'uws') {
      PluginConstructor = UWSConnectionEndpoint
    } else if (plugin.name === 'http') {
      PluginConstructor = HTTPConnectionEndpoint
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
  if (type === 'monitoring') {
    return require('dsx-monitoring') // eslint-disable-line
  }

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

  if (config.auth.name || config.auth.path) {
    const AuthHandler = resolvePluginClass(config.auth, 'authentication')
    if (!AuthHandler) {
      throw new Error(`unable to resolve authentication handler ${config.auth.name || config.auth.path}`)
    }
    config.authenticationHandler = new AuthHandler(config.auth.options, config.logger)
    return
  }

  if (!authStrategies[config.auth.type]) {
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

  if (config.permission.name || config.permission.path) {
    const PermHandler = resolvePluginClass(config.permission, 'permission')
    if (!PermHandler) {
      throw new Error(`unable to resolve plugin ${config.permission.name || config.permission.path}`)
    }
    config.permissionHandler = new PermHandler(config.permission.options, config.logger)
    return
  }

  if (!permissionStrategies[config.permission.type]) {
    throw new Error(`Unknown permission type ${config.permission.type}`)
  }

  if (config.permission.options && config.permission.options.path) {
    config.permission.options.path = fileUtils.lookupConfRequirePath(config.permission.options.path)
  }

  config.permissionHandler = new (permissionStrategies[config.permission.type])(config)
}
