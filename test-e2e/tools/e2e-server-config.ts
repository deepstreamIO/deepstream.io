import { PartialDeepstreamConfig, LOG_LEVEL } from '@deepstream/types'
import * as permissions from '../config/permissions-open.json'

export const getServerConfig = (port: number): PartialDeepstreamConfig => ({
    serverName : `server-${port}`,
    showLogo : false,

    rpc: {
      // This shouldn't be more than response,
      // but it solves issues in E2E tests for HTTP bulk requests for now
      ackTimeout: 100,
      responseTimeout: 100,
    },

    listen: {
      shuffleProviders: false,
      responseTimeout: 2000,
      rematchInterval: 60000,
      matchCooldown: 10000
    },

    permission: {
      type    : 'config',
      options : {
        permissions
      } as any
    },

    httpServer: {
      type: process.env.uws ? 'uws' : 'default',
      options: {
        port
      }
    },

    connectionEndpoints: [
      {
        type: 'ws-binary',
        options: {
          urlPath: '/e2e-v4',
          maxAuthAttempts              : 2,
          unauthenticatedClientTimeout : 200,
          heartbeatInterval: 10000
        } as any
      },
      {
        type: 'ws-text',
        options: {
          urlPath: '/e2e-v3',
          maxAuthAttempts              : 2,
          unauthenticatedClientTimeout : 200,
          heartbeatInterval: 10000
        } as any
      },
      {
        type: 'http',
        options: {
          allowAuthData: true,
          enableAuthEndpoint: true,
        } as any
      }
    ],

    monitoring: {
      type: 'http',
      options: {
        url: '/monitoring',
        allowOpenPermissions: false,
        headerKey: 'deepstream-password',
        headerValue: 'deepstream-secret'
      } as any
    },

    telemetry: {
      type: 'deepstreamIO',
      options: {
        enabled: false
      }
    },

    logger: {
      type: 'default',
      options: {
        logLevel: LOG_LEVEL.WARN
      }
    },

    locks: {
      type: 'default',
      options: {
        holdTimeout            : 1500,
        requestTimeout         : 1500,
      } as any
    },

    clusterNode: {
      type: 'default',
      options: {
      } as any
    },

    clusterRegistry: {
      type: 'default',
      options: {
        keepAliveInterval: 20,
        activeCheckInterval: 200
      } as any
    },

    clusterStates: {
      type: 'default',
      options: {
        reconciliationTimeout : 100,
      } as any
    },

    storage: {
      path: './src/services/cache/local-cache',
      options: {
      } as any
    }
  })
