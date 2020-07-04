import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

import { get as getDefaultOptions } from '../default-options'
import { merge } from '../utils/utils'
import { DeepstreamConfig, LOG_LEVEL, EVENT } from '@deepstream/types'
import Deepstream from '../deepstream.io'
import * as configInitializer from './config-initialiser'
import * as fileUtils from './file-utils'

export type InitialLogs = Array<{
  level: LOG_LEVEL
  message: string
  event: any,
  meta: any
}>

const SUPPORTED_EXTENSIONS = ['.yml', '.yaml', '.json', '.js']
const DEFAULT_CONFIG_DIRS = [
  '/etc/deepstream/conf',
  path.join('.', 'conf', 'config'),
  path.join('..', 'conf', 'config')
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
 * Loads a config file without having to initialize it. Useful for one
 * off operations such as generating a hash via cli
 */
export const loadConfigWithoutInitialization = async function (filePath: string | null = null, initialLogs: InitialLogs = [], args?: object): Promise<{
  config: DeepstreamConfig,
  configPath: string
}> {
  // @ts-ignore
  const argv = args || global.deepstreamCLI || {}
  const configPath = setGlobalConfigDirectory(argv, filePath)

  let configString = fs.readFileSync(configPath, { encoding: 'utf8' })
  configString = configString.replace(/(^#)*#.*$/gm, '$1')
  configString = configString.replace(/^\s*\n/gm, '')
  configString = lookupConfigPaths(configString)
  configString = await loadFiles(configString, initialLogs)

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
export const loadConfig = async function (deepstream: Deepstream, filePath: string | null, args?: object) {
  const logs: InitialLogs = []
  const config = await loadConfigWithoutInitialization(filePath, logs, args)
  const result = configInitializer.initialize(deepstream, config.config, logs)
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
function parseFile<ConfigType = DeepstreamConfig> (filePath: string, fileContent: string): ConfigType {
  const extension = path.extname(filePath)

  if (extension === '.yml' || extension === '.yaml') {
    return yaml.safeLoad(replaceEnvironmentVariables(fileContent)) as unknown as ConfigType
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

  // @ts-ignore
  global.deepstreamConfDir = path.dirname(configPath)
  return configPath
}

/**
* Set the globalLib prefix that will be used as the directory for the logger
* and plugins within the config file
*/
function setGlobalLibDirectory (argv: any, config: DeepstreamConfig): void {
  // @ts-ignore
  const libDir =
      argv.l ||
      argv.libDir ||
      (config.libDir && fileUtils.lookupConfRequirePath(config.libDir)) ||
      process.env.DEEPSTREAM_LIBRARY_DIRECTORY
  // @ts-ignore
  global.deepstreamLibDir = libDir
}

/**
 * Augments the basic configuration with command line parameters
 * and normalizes paths within it
 */
function extendConfig (config: any, argv: any): DeepstreamConfig {
  const cliArgs = {}
  let key

  for (key in getDefaultOptions()) {
    (cliArgs as any)[key] = argv[key]
  }

  return merge({ plugins: {} }, getDefaultOptions(), config, cliArgs) as DeepstreamConfig
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
 * Handle the introduction of global environment variables within
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

function lookupConfigPaths (fileContent: string): string {
  const matches = fileContent.match(/file\((.*)\)/g)
  if (matches) {
    matches.forEach((match) => {
      const [, filename] = match.match(/file\((.*)\)/) as any
      fileContent = fileContent.replace(match, fileUtils.lookupConfRequirePath(filename))
    })
  }
  return fileContent
}

async function loadFiles (fileContent: string, initialLogs: InitialLogs): Promise<string> {
  const matches = fileContent.match(/fileLoad\((.*)\)/g)
  if (matches) {
    const promises = matches.map(async (match) => {
      const [, filename] = match.match(/fileLoad\((.*)\)/) as any
      try {
        let content: string = await new Promise((resolve, reject) =>
          fs.readFile(fileUtils.lookupConfRequirePath(filename), { encoding: 'utf8' }, (err, data) => {
            err ? reject(err) : resolve(data)
          })
        )
        content = replaceEnvironmentVariables(content)
        try {
          if (['.yml', '.yaml', '.js', '.json'].includes(path.extname(filename))) {
            content = parseFile(filename, content)
          }
          initialLogs.push({
            level: LOG_LEVEL.INFO,
            message: `Loaded content from ${fileUtils.lookupConfRequirePath(filename)} for ${match}`,
            event: EVENT.CONFIG_TRANSFORM,
            meta: undefined
          })
        } catch (e) {
          initialLogs.push({
            level: LOG_LEVEL.FATAL,
            event: EVENT.CONFIG_ERROR,
            message: `Error loading config file, invalid format in file ${fileUtils.lookupConfRequirePath(filename)} for ${match}`,
            meta: undefined
          })
        }
        fileContent = fileContent.replace(match, JSON.stringify(content))
      } catch (e) {
        initialLogs.push({
          level: LOG_LEVEL.FATAL,
          event: EVENT.CONFIG_ERROR,
          message: `Error loading config file, missing file ${fileUtils.lookupConfRequirePath(filename)} for ${match}`,
          meta: undefined
        })
      }
    })
    await Promise.all(promises)
  }
  return fileContent
}
