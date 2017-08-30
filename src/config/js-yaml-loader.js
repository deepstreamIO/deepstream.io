'use strict'

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const defaultOptions = require('../default-options')
const utils = require('../utils/utils')

const configInitialiser = require('./config-initialiser')
const fileUtils = require('./file-utils')

const SUPPORTED_EXTENSIONS = ['.yml', '.yaml', '.json', '.js']
const DEFAULT_CONFIG_DIRS = [
  path.join('.', 'conf', 'config'), path.join('..', 'conf', 'config'),
  '/etc/deepstream/config', '/usr/local/etc/deepstream/config',
  '/usr/local/etc/deepstream/conf/config'
]

try {
  require('nexeres') // eslint-disable-line
  DEFAULT_CONFIG_DIRS.push(path.join(process.argv[0], '..', 'conf', 'config'))
  DEFAULT_CONFIG_DIRS.push(path.join(process.argv[0], '..', '..', 'conf', 'config'))
} catch (e) {
  DEFAULT_CONFIG_DIRS.push(path.join(process.argv[1], '..', 'conf', 'config'))
  DEFAULT_CONFIG_DIRS.push(path.join(process.argv[1], '..', '..', 'conf', 'config'))
}

/**
 * Reads and parse a general configuration file content.
 *
 * @param {String} filePath
 * @param {Function} callback
 *
 * @public
 * @returns {void}
 */
exports.readAndParseFile = function (filePath, callback) {
  try {
    fs.readFile(filePath, 'utf8', (error, fileContent) => {
      if (error) {
        return callback(error)
      }

      try {
        const config = parseFile(filePath, fileContent)
        return callback(null, config)
      } catch (parseError) {
        return callback(parseError)
      }
    })
  } catch (error) {
    callback(error)
  }
}

/**
 * Parse a general configuration file
 * These file extension ans formats are allowed:
 * .yml, .js, .json
 *
 * If no fileContent is passed the file is read synchronously
 *
 * @param {String} filePath
 * @param {String} fileContent
 *
 * @private
 * @returns {Object} config
 */
function parseFile (filePath, fileContent) {
  let config = null
  const extension = path.extname(filePath)

  if (extension === '.yml' || extension === '.yaml') {
    config = yaml.safeLoad(replaceEnvironmentVariables(fileContent))
  } else if (extension === '.js') {
    config = require(path.resolve(filePath)) // eslint-disable-line
  } else if (extension === '.json') {
    config = JSON.parse(replaceEnvironmentVariables(fileContent))
  } else {
    throw new Error(`${extension} is not supported as configuration file`)
  }

  return config
}

/**
 * Loads a config file without having to initialise it. Useful for one
 * off operations such as generating a hash via cli
 *
 * @param {Object|String} args commander arguments or path to config
 *
 * @public
 * @returns {Object} config deepstream configuration object
 */
module.exports.loadConfigWithoutInitialisation = function (filePath, /* test only */ args) {
  const argv = args || global.deepstreamCLI || {}
  const configPath = setGlobalConfigDirectory(argv, filePath)
  const configString = fs.readFileSync(configPath, { encoding: 'utf8' })
  const rawConfig = parseFile(configPath, configString)
  const config = extendConfig(rawConfig, argv)
  setGlobalLibDirectory(argv, config)
  return {
    config,
    configPath
  }
}

/**
 * Loads a file as deepstream config. CLI args have highest priority after the
 * configuration file. If some properties are not set they will be defaulted
 * to default values defined in the defaultOptions.js file.
 * Configuraiton file will be transformed to a deepstream object by evaluating
 * some properties like the plugins (logger and connectors).
 *
 * @param {Object|String} args commander arguments or path to config
 *
 * @public
 * @returns {Object} config deepstream configuration object
 */
module.exports.loadConfig = function (filePath, /* test only */ args) {
  const config = exports.loadConfigWithoutInitialisation(filePath, args)
  return {
    config: configInitialiser.initialise(config.config),
    file: config.configPath
  }
}

/**
* Set the globalConfig prefix that will be used as the directory for ssl, permissions and auth
* relative files within the config file
*/
function setGlobalConfigDirectory (argv, filePath) {
  const customConfigPath =
      argv.c ||
      argv.config ||
      filePath ||
      process.env.DEEPSTREAM_CONFIG_DIRECTORY
  const configPath = customConfigPath
    ? verifyCustomConfigPath(customConfigPath)
    : getDefaultConfigPath()
  global.deepstreamConfDir = path.dirname(configPath)
  return configPath
}

/**
* Set the globalLib prefix that will be used as the directory for the logger
* and plugins within the config file
*/
function setGlobalLibDirectory (argv, config) {
  const libDir =
      argv.l ||
      argv.libDir ||
      (config.libDir && fileUtils.lookupConfRequirePath(config.libDir)) ||
      process.env.DEEPSTREAM_LIBRARY_DIRECTORY
  global.deepstreamLibDir = libDir
}

/**
 * Augments the basic configuration with command line parameters
 * and normalizes paths within it
 *
 * @param   {Object} config    configuration
 * @param   {Object} argv      command line arguments
 * @param   {String} configDir config directory
 *
 * @private
 * @returns {Object} extended config
 */
function extendConfig (config, argv) {
  const cliArgs = {}
  let key

  for (key in defaultOptions.get()) {
    cliArgs[key] = argv[key]
  }
  if (argv.port) {
    overrideEndpointOption('port', argv.port, 'websocket', config)
  }
  if (argv.host) {
    overrideEndpointOption('host', argv.host, 'websocket', config)
  }
  if (argv.httpPort) {
    overrideEndpointOption('port', argv.httpPort, 'http', config)
  }
  if (argv.httpHost) {
    overrideEndpointOption('host', argv.httpHost, 'http', config)
  }

  return utils.merge({ plugins: {} }, defaultOptions.get(), config, cliArgs)
}

function overrideEndpointOption (key, value, endpoint, config) {
  try {
    config.connectionEndpoints[endpoint].options[key] = value
  } catch (exception) {
    throw new Error(
      `${key} could not be set: ${endpoint} connection endpoint not found`,
      exception.message
    )
  }
}

/**
 * Checks if a config file is present at a given path
 *
 * @param   {String} configPath the path to the config file
 *
 * @private
 * @returns {String} verified path
 */
function verifyCustomConfigPath (configPath) {
  if (fileUtils.fileExistsSync(configPath)) {
    return configPath
  }

  throw new Error(`Configuration file not found at: ${configPath}`)
}

/**
 * Fallback if no config path is specified. Will attempt to load the file from the default directory
 *
 * @private
 * @returns {String} filePath
 */
function getDefaultConfigPath () {
  let filePath
  let i
  let k

  for (k = 0; k < DEFAULT_CONFIG_DIRS.length; k++) {
    for (i = 0; i < SUPPORTED_EXTENSIONS.length; i++) {
      filePath = DEFAULT_CONFIG_DIRS[k] + SUPPORTED_EXTENSIONS[i]
      if (fileUtils.fileExistsSync(filePath)) {
        return filePath
      }
    }
  }

  throw new Error('No config file found')
}

/**
 * Handle the introduction of global enviroment variables within
 * the yml file, allowing value substitution.
 *
 * For example:
 * ```
 * host: $HOST_NAME
 * port: $HOST_PORT
 * ```
 *
 * @param {String} fileContent The loaded yml file
 *
 * @private
 * @returns {void}
 */
function replaceEnvironmentVariables (fileContent) {
  const environmentVariable = new RegExp(/\${([^}]+)}/g)
  // eslint-disable-next-line
  fileContent = fileContent.replace(environmentVariable, (a, b) => process.env[b] || '')
  return fileContent
}
