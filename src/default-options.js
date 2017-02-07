const utils = require('./utils/utils')
const C = require('./constants/constants')

exports.get = function () {
  var options = {
    /*
     * General
     */
    serverName: utils.getUid(),
    logLevel: C.LOG_LEVEL.INFO,

    /*
     * Connectivity
     */
    port: 6020,
    host: '0.0.0.0',
    urlPath: '/deepstream',
    healthCheckPath: '/healthcheck',
    externalUrl: null,
    heartbeatInterval: 30000,

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
