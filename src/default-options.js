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
          pingInterval: 30000,
          outgoingBufferTimeout: 0,
          maxMessageSize: 1048576,
          noDelay: true,

          /*
           * Security
           */
          unauthenticatedClientTimeout: 180000,
          maxAuthAttempts: 3,
          logInvalidAuthData: true,
          maxMessageSize: 1048576
        }
      }
    },

    /*
     * Redundant connection config (maintained for overriding by environment/CLI)
     */
    port: null,
    host: null,
    urlPath: null,
    healthCheckPath: null,
    pingInterval: null,
    unauthenticatedClientTimeout: null,
    maxAuthAttempts: null,
    logInvalidAuthData: null,
    maxMessageSize: null,

    /*
     * Default Plugins
     */
    messageConnector: require('./default-plugins/noop-message-connector'),
    cache: require('./default-plugins/local-cache'),
    storage: require('./default-plugins/noop-storage'),

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
