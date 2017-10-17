import { getUid } from './utils/utils'
import { LOG_LEVEL } from './constants'
import LocalCache from './default-plugins/local-cache'
import NoopStorage from './default-plugins/noop-storage'
import StdoutLogger from './default-plugins/std-out-logger'
import OpenAuthenticationHandler from './authentication/open-authentication-handler'
import OpenPermissionHandler from './permission/open-permission-handler'
import ClusterNode from './cluster/cluster-node'
import LockRegistry from './cluster/lock-registry'

export function get (): DeepstreamConfig {
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
        name: 'uws',
        options: {
          port: 6020,
          host: '0.0.0.0',
          urlPath: '/deepstream',
          healthCheckPath: '/health-check',
          heartbeatInterval: 30000,
          outgoingBufferTimeout: 0,
          noDelay: true,

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
        name: 'http',
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
          origins: []
        }
      }
    },

    logger: {
      type: 'default',
      options: {}
    },

    plugins: {
      cache: {
        type: 'default-cache',
        options: {}
      },
      storage: {
        type: 'default-storage',
        options: {}
      }
    },

    /*
     * Storage options
     */
    storageExclusion: null,

    /**
     * Listening
     */
    shuffleListenProviders: true,

    /*
     * Timeouts
     */
    rpcAckTimeout: 1000,
    rpcTimeout: 10000,
    cacheRetrievalTimeout: 1000,
    storageRetrievalTimeout: 2000,
    storageHotPathPatterns: [],
    dependencyInitialisationTimeout: 2000,
    stateReconciliationTimeout: 500,
    clusterKeepAliveInterval: 5000,
    clusterActiveCheckInterval: 1000,
    clusterNodeInactiveTimeout: 6000,
    listenResponseTimeout: 500,
    lockTimeout: 1000,
    lockRequestTimeout: 1000,
    broadcastTimeout: 0
  }
}
