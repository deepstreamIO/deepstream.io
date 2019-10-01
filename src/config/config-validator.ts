import * as Ajv from 'ajv'
import { LOG_LEVEL } from '../../ds-types/src/index'

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
  dependencyInitialisationTimeout: { type: 'number', minimum: 1000 },
  logLevel: LogLevelValidation
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
  ['default'],
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
      host: { type: 'string', minLength: 1 },
      port: { type: 'integer', minimum: 1 },
  }
)

const storageOptions = getPluginOptions(
  'storage',
  ['default'],
  {
      host: { type: 'string', minLength: 1 },
      port: { type: 'integer', minimum: 1 },
  }
)

const authenticationOptions = getPluginOptions(
  'auth',
  ['none', 'file', 'http'],
  {
    path: { type: 'string', minLength: 1 },
    hash: { type: 'string', minLength: 1 },
    iterations: { type: 'integer', minimum: 1 },
    keyLength: { type: 'integer', minimum: 1 },

    endpointUrl: { type: 'string', format: 'uri'},
    permittedStatusCodes: { type: 'array', items: { type: 'integer' } },
    requestTimeout: { type: 'integer', minimum: 1 },
  }
)

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
          type: { type: 'string', enum: ['ws-text', 'ws-json', 'uws-websocket', 'ws-websocket', 'node-http', 'mqtt'] },
          name: { type: 'string', minLength: 1 },
          path: { type: 'string', minLength: 1 },
          options: {
            type: 'object',
            properties: {
              port: { type: 'integer', minimum: 1 },
              host: { type: 'string', minLength: 1 },
              healthCheckPath: { type: 'string', minLength: 1 },
              logInvalidAuthData: { type: 'boolean' },
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
  ['default'],
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
  ['http', 'none'],
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
    ...locksOptions,
    ...clusterNodeOptions,
    ...clusterRegistryOptions,
    ...clusterStatesOptions,
    ...customPluginsOptions
  }
}

const ajv = new Ajv()

export const validate  = function (config: Object): void {
  if (!ajv.validate(schema, config)) {
    throw new Error(
      `Invalid configuration: ${ajv.errorsText()}`
    )
  }
}
