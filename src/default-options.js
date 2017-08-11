'use strict'
/* eslint-disable global-require */
const utils = require('./utils/utils')
const C = require('./constants/constants')

exports.get = function () {
  const options = {
    /*
     * General
     */
    serverName: utils.getUid(),
    showLogo: true,
    logLevel: C.LOG_LEVEL.INFO,

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
      type: 'none'
    },

    /*
     * Permissioning
     */
    permission: {
      type: 'none'
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
          logInvalidAuthData: true,
          maxMessageSize: 1048576
        }
      },
      http: {
        name: 'http',
        options: {
          port: 8080,
          host: '0.0.0.0',
          allowAuthData: true,
          enableAuthEndpoint: false,
          authPath: '/auth',
          postPath: '/',
          getPath: '/',
          healthCheckPath: '/health-check',
          allowAllOrigins: true,
          origins: []
        }
      }
    },

    /*
     * Default Plugins
     */
    cache: require('./default-plugins/local-cache'),
    storage: require('./default-plugins/noop-storage'),

    /*
     * Clustering config
     */
    messageConnector: {
      enabled: true,
      host: 'localhost',
      port: 9089,
      seedNodes: [],
      maxReconnectAttempts: 5,
      reconnectInterval: 1500,
      pingInterval: 1000,
      pingTimeout: 500,
      clusterKeepAliveInterval: 5000,
      clusterActiveCheckInterval: 1000,
      clusterNodeInactiveTimeout: 6000
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

  return options
}
