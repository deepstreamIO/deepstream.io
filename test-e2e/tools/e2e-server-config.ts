import { PartialDeepstreamConfig, LOG_LEVEL } from '../../ds-types/src/index'

export const getServerConfig = (port: number): PartialDeepstreamConfig => ({
    serverName : `server-${port}`,
    logLevel: LOG_LEVEL.WARN,
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
        path: './test-e2e/config/permissions-open.json'
      } as any
    },

    connectionEndpoints: [
      {
        type: 'uws-websocket',
        options: {
          port,
          urlPath: '/e2e',
          maxAuthAttempts              : 2,
          unauthenticatedClientTimeout : 200,
        } as any
      },
      {
        type: 'node-http',
        options: {
          port: Number(port) + 200,
          allowAuthData: true,
          enableAuthEndpoint: true,
        } as any
      }
    ],

    monitoring: {
      type: 'default',
      options: {
        reportInterval: 200,
        permissionLogLimit: 3,
        technicalErrorLogLimit: 3
      } as any
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
