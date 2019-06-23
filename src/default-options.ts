import { getUid } from './utils/utils'
import { LOG_LEVEL } from './constants'
import { DeepstreamConfig } from './types'

export function get (): DeepstreamConfig {
  return {
    /*
     * General
     */
    libDir: null,
    serverName: getUid(),
    showLogo: true,
    logLevel: LOG_LEVEL.INFO,
    dependencyInitialisationTimeout: 2000,
    exitOnPluginError: false,

    /*
     * Connectivity
     */
    externalUrl: null,

    /*
     * SSL Configuration
     */
    sslKey: null,
    sslCert: null,
    sslDHParams: null,
    sslPassphrase: null,

    /*
     * Connection Endpoints
     */
    connectionEndpoints: {
      websocket: {
        type: 'default',
        options: {
          port: 6020,
          host: '0.0.0.0',
          urlPath: '/deepstream',
          healthCheckPath: '/health-check',
          heartbeatInterval: 30000,
          outgoingBufferTimeout: 0,
          noDelay: true,
          headers: [],

          /*
           * Security
           */
          unauthenticatedClientTimeout: 180000,
          maxAuthAttempts: 3,
          logInvalidAuthData: false,
          perMessageDeflate: false,
          maxMessageSize: 1048576
        }
      },
      http: {
        type: 'default',
        options: {
          port: 8080,
          host: '0.0.0.0',
          allowAuthData: true,
          enableAuthEndpoint: true,
          authPath: '/auth',
          postPath: '/',
          getPath: '/',
          healthCheckPath: '/health-check',
          allowAllOrigins: true,
          origins: [],
          headers: [],
          maxMessageSize: 1024
        }
      }
    },

    logger: {
      type: 'default',
      options: {}
    },

    subscriptions: {
      type: 'default',
      options: {}
    },

    auth: {
      type: 'none',
      options: {}
    },

    permission: {
      type: 'none',
      options: {}
    },

    cache: {
      type: 'default',
      options: {}
    },

    storage: {
      type: 'default',
      options: {}
    },

    monitoring: {
      type: 'default',
      options: {}
    },

    cluster: {
      message: {
        type: 'default',
        options: {
        }
      },
      registry: {
        type: 'default',
        options: {
          keepAliveInterval: 5000,
          activeCheckInterval: 1000,
          nodeInactiveTimeout: 6000
        }
      },
      states: {
        type: 'default',
        options: {
          reconciliationTimeout: 500
        }
      },
      locks: {
        type: 'default',
        options: {
          holdTimeout: 1000,
          requestTimeout: 1000
        }
      }
    },

    plugins: {
    },

    rpc: {
      /**
       * Send requestorName by default.
       * Overriden by provideRequestorDetails
       */
      provideRequestorName: true,
      /**
       * Send requestorData by default.
       * Overriden by provideRequestorDetails
       */
      provideRequestorData: true,

      ackTimeout: 1000,
      responseTimeout: 10000,
    },

    record: {
      storageHotPathPrefixes: [],
      storageExclusionPrefixes: [],
      cacheRetrievalTimeout: 1000,
      storageRetrievalTimeout: 2000,
    },

    listen: {
      shuffleProviders: true,
      responseTimeout: 500,
      rematchInterval: 30000,
      matchCooldown: 10000
    }
  }
}
