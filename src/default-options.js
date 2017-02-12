'use strict'

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
    port: 6020,
    host: '0.0.0.0',
    urlPath: '/deepstream',
    healthCheckPath: '/health-check',
    externalUrl: null,
    heartbeatInterval: 30000,

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
    * Default Plugins
    */
    messageConnector: require('./default-plugins/noop-message-connector'),
    cache: require('./default-plugins/local-cache'),
    storage: require('./default-plugins/noop-storage'),

    /*
    * Storage options
    */
    storageExclusion: null,

    /*
    * Security
    */
    unauthenticatedClientTimeout: 180000,
    maxAuthAttempts: 3,
    logInvalidAuthData: true,
    maxMessageSize: 1048576,

    /*
    * Timeouts
    */
    rpcAckTimeout: 1000,
    rpcTimeout: 10000,
    cacheRetrievalTimeout: 1000,
    storageRetrievalTimeout: 2000,
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
