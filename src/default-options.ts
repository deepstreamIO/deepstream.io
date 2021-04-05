import { getUid } from './utils/utils'
import { DeepstreamConfig, LOG_LEVEL } from '@deepstream/types'

const WebSocketDefaultOptions = {
  urlPath: '/deepstream',
  heartbeatInterval: 30000,
  outgoingBufferTimeout: 0,
  maxBufferByteSize: 100000,
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

export function get (): DeepstreamConfig {
  return {
    /*
     * General
     */
    libDir: null,
    serverName: getUid(),
    showLogo: false,
    logLevel: LOG_LEVEL.INFO,
    dependencyInitializationTimeout: 2000,
    // defaults to false as the event is captured via commander when run via binary or standalone
    exitOnFatalError: false,

    /*
     * Connectivity
     */
    externalUrl: null,

    /*
     * Connection Endpoints
     */
    connectionEndpoints: [
    {
        type: 'ws-binary',
        options:  { ...WebSocketDefaultOptions, urlPath: '/deepstream' }
    },
    {
        type: 'ws-text',
        options: { ...WebSocketDefaultOptions, urlPath: '/deepstream-v3' }
    },
    {
        type: 'ws-json',
        options: { ...WebSocketDefaultOptions, urlPath: '/deepstream-json' }
      },
      {
        type: 'http',
        options: {
          allowAuthData: true,
          enableAuthEndpoint: true,
          authPath: '/api/auth',
          postPath: '/api',
          getPath: '/api'
        }
      },
      {
        type: 'mqtt',
        options: {
          port: 1883,
          host: '0.0.0.0',
          idleTimeout: 180000,

          /*
           * Security
           */
          unauthenticatedClientTimeout: 180000,
        }
      }
    ],

    logger: {
      type: 'default',
      options: {}
    },

    httpServer: {
      type: 'default',
      options: {
        host: '0.0.0.0',
        port: 6020,
        healthCheckPath: '/health-check',
        allowAllOrigins: true,
        origins: [],
        headers: [],
        maxMessageSize: 1024
      }
    },

    subscriptions: {
      type: 'default',
      options: {
        subscriptionsSanityTimer: 10000
      }
    },

    auth: [{
      type: 'none',
      options: {}
    }],

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
      type: 'none',
      options: {}
    },

    telemetry: {
      type: 'deepstreamIO',
      options: {
        enabled: false,
      }
    },

    locks: {
      type: 'default',
      options: {
        holdTimeout: 1000,
        requestTimeout: 1000
      }
    },

    clusterNode: {
      type: 'default',
      options: {
      }
    },

    clusterRegistry: {
      type: 'default',
      options: {
        keepAliveInterval: 5000,
        activeCheckInterval: 1000,
        nodeInactiveTimeout: 6000
      }
    },

    clusterStates: {
      type: 'default',
      options: {
        reconciliationTimeout: 500
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
    },

    enabledFeatures: {
      record: true,
      event: true,
      rpc: true,
      presence: true,
      monitoring: false
    },
  }

}
