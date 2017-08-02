const C = require('./constants/constants')

exports.get = function () {
  var options = {
    /*
     * General
     */
    logLevel: C.LOG_LEVEL.INFO,

    /*
     * Connectivity
     */
    port: 6020,
    host: '0.0.0.0',
    urlPath: '/deepstream',
    healthCheckPath: '/healthcheck',
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
    rpcTimeout: 10000,
    dependencyInitialisationTimeout: 2000,
    listenResponseTimeout: 500,
    broadcastTimeout: 0
  }

  return options
}
