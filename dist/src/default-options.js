"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils/utils");
const constants_1 = require("./constants");
function get() {
    return {
        /*
         * General
         */
        libDir: null,
        serverName: utils_1.getUid(),
        showLogo: true,
        logLevel: constants_1.LOG_LEVEL.DEBUG,
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
                name: 'default-cache',
                options: {}
            },
            storage: {
                name: 'default-storage',
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
    };
}
exports.get = get;
//# sourceMappingURL=default-options.js.map