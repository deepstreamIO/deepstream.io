import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

import { get as getDefaultOptions } from '../default-options'
import { merge } from '../utils/utils'
import { InternalDeepstreamConfig } from '../types'

const configInitialiser = require('./config-initialiser')
const fileUtils = require('./file-utils')

const SUPPORTED_EXTENSIONS = ['.yml', '.yaml', '.json', '.js']
const DEFAULT_CONFIG_DIRS = [
  path.join('.', 'conf', 'config'), path.join('..', 'conf', 'config'),
  '/etc/deepstream/config', '/usr/local/etc/deepstream/config',
  '/usr/local/etc/deepstream/conf/config',
]

DEFAULT_CONFIG_DIRS.push(path.join(process.argv[1], '..', 'conf', 'config'))
DEFAULT_CONFIG_DIRS.push(path.join(process.argv[1], '..', '..', 'conf', 'config'))

/**
 * Reads and parse a general configuration file content.
 */
export const readAndParseFile = function (filePath: string, callback: Function): void {
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
 * Loads a config file without having to initialise it. Useful for one
 * off operations such as generating a hash via cli
 */
export const loadConfigWithoutInitialisation = function (filePath: string | null = null, args?: object): any {
  const argv = args || global.deepstreamCLI || {}
  const configPath = setGlobalConfigDirectory(argv, filePath)
  const configString = fs.readFileSync(configPath, { encoding: 'utf8' })
  const rawConfig = parseFile(configPath, configString)
  const config = extendConfig(rawConfig, argv)
  setGlobalLibDirectory(argv, config)
  return {
    config,
    configPath,
  }
}

/**
 * Loads a file as deepstream config. CLI args have highest priority after the
 * configuration file. If some properties are not set they will be defaulted
 * to default values defined in the defaultOptions.js file.
 * Configuraiton file will be transformed to a deepstream object by evaluating
 * some properties like the plugins (logger and connectors).
 */
export const loadConfig = function (filePath: string | null, args?: object) {
  const config = loadConfigWithoutInitialisation(filePath, args)
  const result = configInitialiser.initialise(config.config)
  return {
    config: result.config,
    services: result.services,
    file: config.configPath,
  }
}

/**
 * Parse a general configuration file
 * These file extension ans formats are allowed:
 * .yml, .js, .json
 *
 * If no fileContent is passed the file is read synchronously
 */
function parseFile (filePath: string, fileContent: string): InternalDeepstreamConfig {
  const extension = path.extname(filePath)

  if (extension === '.yml' || extension === '.yaml') {
    return yaml.safeLoad(replaceEnvironmentVariables(fileContent))
  } else if (extension === '.js') {
    return require(path.resolve(filePath))
  } else if (extension === '.json') {
    return JSON.parse(replaceEnvironmentVariables(fileContent))
  } else {
    throw new Error(`${extension} is not supported as configuration file`)
  }
}

/**
* Set the globalConfig prefix that will be used as the directory for ssl, permissions and auth
* relative files within the config file
*/
function setGlobalConfigDirectory (argv: any, filePath?: string | null): string {
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
function setGlobalLibDirectory (argv: any, config: InternalDeepstreamConfig): void {
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
 */
function extendConfig (config: any, argv: any): InternalDeepstreamConfig {
  const cliArgs = {}
  let key

  for (key in getDefaultOptions()) {
    (cliArgs as any)[key] = argv[key]
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

  return merge({ plugins: {} }, getDefaultOptions(), config, cliArgs) as InternalDeepstreamConfig
}

function overrideEndpointOption (key: string, value: string, endpoint: string, config: InternalDeepstreamConfig) {
  try {
    config.connectionEndpoints[endpoint].options[key] = value
  } catch (exception) {
    throw new Error(`${key} could not be set: ${endpoint} connection endpoint not found`)
  }
}

/**
 * Checks if a config file is present at a given path
 */
function verifyCustomConfigPath (configPath: string): string {
  if (fileUtils.fileExistsSync(configPath)) {
    return configPath
  }

  throw new Error(`Configuration file not found at: ${configPath}`)
}

/**
 * Fallback if no config path is specified. Will attempt to load the file from the default directory
 */
function getDefaultConfigPath (): string {
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
 */
function replaceEnvironmentVariables (fileContent: string): string {
  const environmentVariable = new RegExp(/\${([^}]+)}/g)
  return fileContent.replace(environmentVariable, (a, b) => process.env[b] || '')
}
