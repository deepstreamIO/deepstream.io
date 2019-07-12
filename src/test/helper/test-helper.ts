import * as SocketWrapperFactoryMock from '../mock/socket-wrapper-factory-mock'
import AuthenticationHandler from '../mock/authentication-handler-mock'

export const getBasePermissions = function () {
  return {
    presence: {
      '*': {
        allow: true
      }
    },
    record: {
      '*': {
        write: true,
        read: true
      }
    },
    event: {
      '*': {
        publish: true,
        subscribe: true
      }
    },
    rpc: {
      '*': {
        provide: true,
        request: true
      }
    }
  }
}

import {get} from '../../default-options'
import MessageConnectorMock from '../mock/message-connector-mock'
import LoggerMock from '../mock/logger-mock'
import StorageMock from '../mock/storage-mock'
import { DeepstreamConfig, DeepstreamServices, SocketWrapper, Monitoring, DeepstreamPlugin, PermissionCallback, UserAuthData, LOG_LEVEL, EVENT } from '../../types'
import { Message } from '../../constants'
import { DefaultSubscriptionRegistryFactory } from '../../services/subscription-registry/default-subscription-registry-factory'
import { DistributedStateRegistryFactory } from '../../services/cluster-state/distributed-state-registry-factory'

export const getDeepstreamOptions = (serverName?: string): { config: DeepstreamConfig, services: DeepstreamServices } => {
  const config = { ...get(), ...{
    serverName: serverName || 'server-name-a',

    cluster: {
      state: {
        options: {
          reconciliationTimeout: 50
        }
      }
    },
    permission: {
      options: {
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 3
      }
    },
    rpc: {
      provideRequestorData: true,
      provideRequestorName: true,
      ackTimeout: 10,
      responseTimeout: 20,
    },
    record: {
      cacheRetrievalTimeout: 30,
      storageRetrievalTimeout: 50,
      storageExclusionPrefixes: ['no-storage'],
      storageHotPathPrefixes: [],
    }
  }} as never as DeepstreamConfig

  class PermissionHandler extends DeepstreamPlugin implements PermissionHandler {
    public lastArgs: any[]
    public description: string
    public nextResult: boolean
    public nextError: string | null

    constructor () {
      super()
      this.description = 'Test Permission Handler'
      this.nextResult = true
      this.nextError = null
      this.lastArgs = []
    }

    public canPerformAction (user: string, message: Message, callback: PermissionCallback, authData: UserAuthData, socketWrapper: SocketWrapper, passItOn: any) {
      this.lastArgs.push([user, message, callback])
      callback(socketWrapper, message, passItOn, this.nextError, this.nextResult)
    }
  }

// tslint:disable-next-line: max-classes-per-file
  class MonitoringMock extends DeepstreamPlugin implements Monitoring {
    public description = 'monitoring mock'
    public onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void {
    }
    public onLogin (allowed: boolean, endpointType: string): void {
    }
    public onMessageRecieved (message: Message): void {
    }
    public onMessageSend (message: Message): void {
    }
    public onBroadcast (message: Message, count: number): void {
    }
  }

  const services: Partial<DeepstreamServices> = {
    logger: new LoggerMock(),
    cache: new StorageMock(),
    storage: new StorageMock(),
    clusterNode: new MessageConnectorMock(config),
    // @ts-ignore
    locks: {
      get (name, cb) { cb(true) },
      release () {}
    },
    monitoring: new MonitoringMock(),
    authenticationHandler: new AuthenticationHandler(),
    permission: new PermissionHandler(),
    connectionEndpoints: [],
  }
  services.subscriptions = new DefaultSubscriptionRegistryFactory({}, services as DeepstreamServices, config)
  services.clusterStates = new DistributedStateRegistryFactory({}, services as DeepstreamServices, config)
  return { config, services } as { config: DeepstreamConfig, services: DeepstreamServices}
}

export const getDeepstreamPermissionOptions = function () {
  const options = exports.getDeepstreamOptions()
  options.config = Object.assign(options.config, {
    cacheRetrievalTimeout: 500,
  })
  return { config: options.config, services: options.services }
}

const ConfigPermission = require('../../services/permission/valve/config-permission').ConfigPermission

export const testPermission = function (options: { config: DeepstreamConfig, services: DeepstreamServices }) {
  return function (permissions: any, message: Message, username?: string, userdata?: UserAuthData, callback?: PermissionCallback) {
    const permission = new ConfigPermission(options.config.permission.options, options.services, options.config, permissions)
    permission.setRecordHandler({
      removeRecordRequest: () => {},
      runWhenRecordStable: (r: any, c: any) => { c(r) }
    })
    let permissionResult

    username = username || 'someUser'
    userdata = userdata || {}
    callback = callback || function (socketWrapper: SocketWrapper, msg: Message, passItOn: any, error: any, result: boolean) {
      permissionResult = result
    }
    permission.canPerformAction(
      username, message, callback, userdata, SocketWrapperFactoryMock.createSocketWrapper()
    )
    return permissionResult
  }
}
