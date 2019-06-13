import { getUid } from './utils/utils'
import { LOG_LEVEL } from './constants'
import { InternalDeepstreamConfig } from './types'

export function get (): InternalDeepstreamConfig {
  return {
    /*
     * General
     */
    libDir: null,
    serverName: getUid(),
    showLogo: true,
    logLevel: LOG_LEVEL.DEBUG,

    /*
     * Connectivity
     */
    externalUrl: null,

    /*
     * SSL Configuration
     */
    sslKey: null,
    sslCert: null,
    sslCa: null,

    /*
     * Authentication
     */
    auth: {
      type: 'none',
      options: {}
    },

    /*
     * Permissioning
     */
    permission: {
      type: 'none',
      options: {}
    },

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

    plugins: {
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
      state: {
        type: 'local',
        options: {
          stateReconciliationTimeout: 500
        }
      },
      cluster: {
        type: 'default',
        options: {
          clusterKeepAliveInterval: 5000,
          clusterActiveCheckInterval: 1000,
          clusterNodeInactiveTimeout: 6000
        }
      },
      locks: {
        type: 'default',
        options: {
          lockTimeout: 1000,
          lockRequestTimeout: 1000
        }
      }
    },

    /*
     * Storage options
     */
    storageExclusionPrefixes: [],

    /**
     * Listening
     */
    shuffleListenProviders: true,

    /**
     * RPC
     */
    provideRPCRequestorDetails: true,

    /**
     * Send requestorName by default.
     * Overriden by provideRPCRequestorDetails
     */
    provideRPCRequestorName: true,

    /**
     * Send requestorData by default.
     * Overriden by provideRPCRequestorDetails
     */
    provideRPCRequestorData: true,

    /*
     * Timeouts
     */
    rpcAckTimeout: 1000,
    rpcTimeout: 10000,
    cacheRetrievalTimeout: 1000,
    storageRetrievalTimeout: 2000,
    storageHotPathPrefixes: [],
    dependencyInitialisationTimeout: 2000,
    listenResponseTimeout: 500,
    exitOnPluginError: false
  }
}
