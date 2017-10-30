"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Ajv = require("ajv");
const constants_1 = require("../constants");
const generalOpts = {
    libDir: { type: ['string', 'null'] },
    serverName: { type: 'string', minLength: 1 },
    showLogo: { type: 'boolean' },
    logLevel: {
        type: ['string', 'integer'],
        enum: [
            'DEBUG', constants_1.LOG_LEVEL.DEBUG,
            'INFO', constants_1.LOG_LEVEL.INFO,
            'WARN', constants_1.LOG_LEVEL.WARN,
            'ERROR', constants_1.LOG_LEVEL.ERROR,
            'OFF', constants_1.LOG_LEVEL.OFF
        ]
    },
    /**
     * backwards compatibility options in the root level
     */
    unauthenticatedClientTimeout: { type: ['integer', 'boolean'], minimum: 1 },
    maxAuthAttempts: { type: 'integer', minimum: 1 },
};
const connectivityOpts = {
    externalUrl: { type: ['null', 'string'], format: 'uri' }
};
const sslOpts = {
    sslKey: { type: ['null', 'string'], minLength: 1 },
    sslCert: { type: ['null', 'string'], minLength: 1 },
    sslCa: { type: ['null', 'string'], minLength: 1 }
};
const pluginsOpts = {
    plugins: {
        type: ['null', 'object'],
        properties: {
            cache: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['default'] },
                    name: { type: 'string', minLength: 1 },
                    path: { type: 'string', minLength: 1 },
                    options: {
                        type: 'object',
                        properties: {
                            host: { type: 'string', minLength: 1 },
                            port: { type: 'integer', minimum: 1 },
                        }
                    }
                }
            },
            storage: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['default'] },
                    name: { type: 'string', minLength: 1 },
                    path: { type: 'string', minLength: 1 },
                    options: {
                        type: 'object',
                        properties: {
                            host: { type: 'string', minLength: 1 },
                            port: { type: 'integer', minimum: 1 },
                        }
                    }
                }
            }
        }
    }
};
const storageOpts = {
    storageExclusion: { type: ['null', 'string'] },
    storageHotPathPatterns: { type: ['null', 'array'], items: { type: 'string' } }
};
const authenticationOpts = {
    auth: {
        type: 'object',
        properties: {
            type: { type: 'string', enum: ['none', 'file', 'http'] },
            name: { type: 'string', minLength: 1 },
            path: { type: 'string', minLength: 1 },
            options: {
                type: 'object',
                properties: {
                    path: { type: 'string', minLength: 1 },
                    hash: { type: 'string', minLength: 1 },
                    iterations: { type: 'integer', minimum: 1 },
                    keyLength: { type: 'integer', minimum: 1 },
                    endpointUrl: { type: 'string', format: 'uri' },
                    permittedStatusCodes: { type: 'array', items: { type: 'integer' } },
                    requestTimeout: { type: 'integer', minimum: 1 },
                }
            }
        }
    }
};
const permissionOpts = {
    permission: {
        type: 'object',
        properties: {
            type: { type: 'string', enum: ['config', 'none'] },
            name: { type: 'string', minLength: 1 },
            path: { type: 'string', minLength: 1 },
            options: {
                type: 'object',
                properties: {
                    path: { type: 'string', minLength: 1 },
                    maxRuleIterations: { type: 'integer', minimum: 1 },
                    cacheEvacuationInterval: { type: 'integer', minimum: 1 }
                }
            }
        }
    }
};
const connEndpointsOpts = {
    connectionEndpoints: {
        type: 'object',
        properties: {
            websocket: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['default'] },
                    name: { type: 'string', minLength: 1 },
                    path: { type: 'string', minLength: 1 },
                    options: {
                        type: 'object',
                        properties: {
                            port: { type: 'integer', minimum: 1 },
                            host: { type: 'string', minLength: 1 },
                            urlPath: { type: 'string', minLength: 1 },
                            healthCheckPath: { type: 'string', minLength: 1 },
                            heartbeatInterval: { type: 'integer', minimum: 1 },
                            outgoingBufferTimeout: { type: 'integer', minimum: 0 },
                            unauthenticatedClientTimeout: { type: ['integer', 'boolean'], minimum: 1 },
                            maxAuthAttempts: { type: 'integer', minimum: 1 },
                            logInvalidAuthData: { type: 'boolean' },
                            maxMessageSize: { type: 'integer', minimum: 0 }
                        }
                    }
                }
            },
            http: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['default'] },
                    name: { type: 'string', minLength: 1 },
                    path: { type: 'string', minLength: 1 },
                    options: {
                        type: 'object',
                        properties: {
                            port: { type: 'integer', minimum: 1 },
                            host: { type: 'string', minLength: 1 },
                            allowAuthData: { type: 'boolean' },
                            enableAuthEndpoint: { type: 'boolean' },
                            authPath: { type: 'string', minLength: 1 },
                            postPath: { type: 'string', minLength: 1 },
                            getPath: { type: 'string', minLength: 1 },
                            healthCheckPath: { type: 'string', minLength: 1 },
                            allowAllOrigins: { type: 'boolean' },
                            origins: { type: 'array', items: { type: 'string', format: 'uri' } }
                        }
                    }
                }
            }
        }
    }
};
const loggerOpts = {
    logger: {
        type: 'object',
        properties: {
            type: { type: 'string', enum: ['default'] },
            name: { type: 'string', minLength: 1 },
            path: { type: 'string', minLength: 1 },
            options: {
                type: 'object',
                properties: {
                    colors: { type: 'boolean' },
                    logLevel: { type: 'string', minLength: 1 },
                    host: { type: 'string', minLength: 1 },
                    options: { type: 'object' }
                }
            }
        }
    }
};
const timeoutOpts = {
    rpcAckTimeout: { type: 'integer', minimum: 1 },
    rpcTimeout: { type: 'integer', minimum: 1 },
    cacheRetrievalTimeout: { type: 'integer', minimum: 1 },
    storageRetrievalTimeout: { type: 'integer', minimum: 1 },
    dependencyInitialisationTimeout: { type: 'integer', minimum: 1 },
    listenResponseTimeout: { type: 'integer', minimum: 1 },
    broadcastTimeout: { type: 'integer', minimum: -1 },
    stateReconciliationTimeout: { type: 'integer', minimum: 1 },
};
const listeningOpts = {
    shuffleListenProviders: { type: 'boolean' }
};
const schema = {
    additionalProperties: true,
    properties: Object.assign({}, generalOpts, connectivityOpts, sslOpts, pluginsOpts, storageOpts, authenticationOpts, permissionOpts, connEndpointsOpts, loggerOpts, timeoutOpts, listeningOpts)
};
const ajv = new Ajv();
exports.validate = function (config) {
    if (!ajv.validate(schema, config)) {
        throw new Error(`Invalid configuration: ${ajv.errorsText()}`);
    }
};
//# sourceMappingURL=config-validator.js.map