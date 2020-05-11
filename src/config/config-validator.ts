import * as Ajv from 'ajv'
import * as betterAjvErrors from 'better-ajv-errors'

import { LOG_LEVEL } from '@deepstream/types'

const LogLevelValidation = {
  type: ['string', 'integer'],
  enum: [
    'DEBUG', LOG_LEVEL.DEBUG,
    'INFO', LOG_LEVEL.INFO,
    'WARN', LOG_LEVEL.WARN,
    'ERROR', LOG_LEVEL.ERROR,
    'OFF', LOG_LEVEL.OFF
  ]
}

function getPluginOptions (name: string, types: string[], properties: any) {
  return {
    [name]: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: types },
        name: { type: 'string', minLength: 1 },
        path: { type: 'string', minLength: 1 },
        options: {
          type: 'object',
          properties
        }
      },
      oneRequired: ['type', 'name', 'path']
    }
  }
}

const generalOptions = {
  libDir: { type: ['string', 'null'] },
  serverName: { type: 'string', minLength: 1 },
  externalUrl: { type: ['null', 'string'] },
  showLogo: { type: 'boolean' },
  exitOnFatalError: { type: 'boolean' },
  dependencyInitializationTimeout: { type: 'number', minimum: 1000 },
  logLevel: LogLevelValidation
}

const enabledFeatures = {
  enabledFeatures: {
    record: { type: 'boolean' },
    event: { type: 'boolean' },
    rpc: { type: 'boolean' },
    presence: { type: 'boolean' },
    monitoring: { type: 'boolean' },
  }
}

const rpcOptions = {
  rpc: {
    type: ['object'],
    ackTimeout: { type: 'integer', minimum: 1 },
    responseTimeout: { type: 'integer', minimum: 1 }
  }
}

const recordOptions = {
  record: {
    type: ['object'],
    cacheRetrievalTimeout: { type: 'integer', minimum: 50 },
    storageRetrievalTimeout: { type: 'integer', minimum: 50 },
    storageExclusionPrefixes: { type: ['null', 'array'], items: { type: 'string' } },
    storageHotPathPrefixes: { type: ['null', 'array'], items: { type: 'string' } }
  }
}

const listenOptions = {
  listen: {
    type: ['object'],
    shuffleProviders: { type: 'boolean' },
    responseTimeout: { type: 'integer', minimum: 50 },
    rematchInterval: { type: 'integer', minimum: 50 },
    matchCooldown: { type: 'integer', minimum: 50 },
  }
}

const httpServer = getPluginOptions(
  'httpServer',
  ['default', 'uws'],
  {
      host: { type: 'string', minLength: 1 },
      port: { type: 'integer', minimum: 1 },
      allowAllOrigins: { type: 'boolean' },
      origins: { type: 'array', items: { type: 'string', format: 'uri' } },
  }
)

const cacheOptions = getPluginOptions(
  'cache',
  ['default'],
  {
  }
)

const storageOptions = getPluginOptions(
  'storage',
  ['default'],
  {
  }
)

const telemetryOptions = getPluginOptions(
  'telemetry',
  ['deepstreamIO'],
  {
    enabled: { type: 'boolean' }
  }
)

const authenticationOptions = {
  auth: {
    type: 'array',
    items: {
      properties: {
        type: { type: 'string', enum: ['none', 'file', 'http', 'storage'] },
        name: { type: 'string', minLength: 1 },
        path: { type: 'string', minLength: 1 },
        options: {
          type: 'object',
          properties: {
            hash: { type: 'string', minLength: 1 },
            iterations: { type: 'integer', minimum: 1 },
            keyLength: { type: 'integer', minimum: 1 },
            createUser: { type: 'boolean' },
            table: { type: 'string', minLength: 1 },
            endpointUrl: { type: 'string', format: 'uri'},
            permittedStatusCodes: { type: 'array', items: { type: 'integer' } },
            requestTimeout: { type: 'integer', minimum: 1 },
          }
        }
      }
    }
  }
}

const permissionOptions = getPluginOptions(
  'permission',
  ['config', 'none'],
  {
    path: { type: 'string', minLength: 1 },
    maxRuleIterations: { type: 'integer', minimum: 1 },
    cacheEvacuationInterval: { type: 'integer', minimum: 1 }
  }
)

const connEndpointsOptions = {
  connectionEndpoints: {
    type: 'array',
    items: {
    properties: {
          type: { type: 'string', enum: ['ws-text', 'ws-json', 'ws-binary', 'http', 'mqtt'] },
          name: { type: 'string', minLength: 1 },
          path: { type: 'string', minLength: 1 },
          options: {
            type: 'object',
            properties: {
              port: { type: 'integer', minimum: 1 },
              host: { type: 'string', minLength: 1 },
              healthCheckPath: { type: 'string', minLength: 1 },
              maxMessageSize: { type: 'integer', minimum: 0 },

              // WEBSOCKET
              urlPath: { type: 'string', minLength: 1 },
              heartbeatInterval: { type: 'integer', minimum: 1 },
              outgoingBufferTimeout: { type: 'integer', minimum: 0 },

              unauthenticatedClientTimeout: { type: ['integer', 'boolean'], minimum: 1 },
              maxAuthAttempts: { type: 'integer', minimum: 1 },

              // HTTP
              allowAuthData: { type: 'boolean' },
              enableAuthEndpoint: { type: 'boolean' },
              authPath: { type: 'string', minLength: 1 },
              postPath: { type: 'string', minLength: 1 },
              getPath: { type: 'string', minLength: 1 },
          }
        }
      }
    }
  }
}

const loggerOptions = getPluginOptions(
  'logger',
  ['default', 'json'],
  {
    colors: { type: 'boolean' },
    logLevel: LogLevelValidation,
    options: { type: 'object' }
  }
)

const subscriptionsOptions = getPluginOptions(
  'subscriptions',
  ['default'],
  {
    subscriptionsSanityTimer: { type: 'integer', minimum: 50 },
  }
)

const monitoringOptions = getPluginOptions(
  'monitoring',
  ['http', 'log', 'none'],
  {
  }
)

const locksOptions = getPluginOptions(
  'locks',
  ['default'],
  {
    holdTimeout: { type: 'integer', minimum: 50 },
    requestTimeout: { type: 'integer', minimum: 50 },
  }
)

const clusterNodeOptions = getPluginOptions(
  'clusterNode',
  ['default'],
  {
  }
)

const clusterRegistryOptions = getPluginOptions(
  'clusterRegistry',
  ['default'],
  {
    keepAliveInterval: { type: 'integer', minimum: 1 },
    activeCheckInterval: { type: 'integer', minimum: 1 },
    nodeInactiveTimeout: { type: 'integer', minimum: 1 },
  }
)

const clusterStatesOptions = getPluginOptions(
  'clusterStates',
  ['default'],
  {
    reconciliationTimeout: { type: 'integer', minimum: 1 },
  }
)

const customPluginsOptions = {
  plugins: {
    type: ['null', 'object'],
    properties: {
    }
  }
}

const schema = {
  additionalProperties: false,
  properties: {
    ...generalOptions,
    ...enabledFeatures,
    ...rpcOptions,
    ...recordOptions,
    ...listenOptions,
    ...httpServer,
    ...connEndpointsOptions,
    ...loggerOptions,
    ...cacheOptions,
    ...storageOptions,
    ...authenticationOptions,
    ...permissionOptions,
    ...subscriptionsOptions,
    ...monitoringOptions,
    ...telemetryOptions,
    ...locksOptions,
    ...clusterNodeOptions,
    ...clusterRegistryOptions,
    ...clusterStatesOptions,
    ...customPluginsOptions
  }
}

export const validate = function (config: Object): void {
  const ajv = new Ajv({ jsonPointers: true, allErrors: true })
  const validator = ajv.compile(schema)
  const valid = validator(config)

  if (!valid) {
    const output = (betterAjvErrors(schema, config, validator.errors, { format: 'js' }) as never as betterAjvErrors.IOutputError[])
    console.error('There was an error validating your configuration:')
    output.forEach((e, i) => console.error(`${i + 1})${e.error}${e.suggestion ? `. ${e.suggestion}` : ''}`))
    process.exit(1)
  }
}
