import * as SocketWrapperFactoryMock from '../mock/socket-wrapper-factory-mock'
import AuthenticationHandler from '../mock/authentication-handler-mock'
import {get} from '../../default-options'
import MessageConnectorMock from '../mock/message-connector-mock'
import LoggerMock from '../mock/logger-mock'
import StorageMock from '../mock/storage-mock'
import { DeepstreamConfig, DeepstreamServices, SocketWrapper, DeepstreamMonitoring, DeepstreamPlugin, PermissionCallback, LOG_LEVEL, EVENT } from '../../../ds-types/src/index'
import { Message } from '../../constants'
import { DefaultSubscriptionRegistryFactory } from '../../services/subscription-registry/default-subscription-registry-factory'
import { DistributedStateRegistryFactory } from '../../services/cluster-state/distributed-state-registry-factory'
import { DistributedClusterRegistry } from '../../services/cluster-registry/distributed-cluster-registry'

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

    public canPerformAction (socketWrapper: SocketWrapper, message: Message, callback: PermissionCallback, passItOn: any) {
      this.lastArgs.push([socketWrapper.userId, message, callback])
      callback(socketWrapper, message, passItOn, this.nextError, this.nextResult)
    }
  }

// tslint:disable-next-line: max-classes-per-file
  class MonitoringMock extends DeepstreamPlugin implements DeepstreamMonitoring {
    public description = 'monitoring mock'
    public onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void {
    }
    public onLogin (allowed: boolean, endpointType: string): void {
    }
    public onMessageReceived (message: Message): void {
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
  services.clusterRegistry = new DistributedClusterRegistry({}, services as DeepstreamServices, config)
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
  return function (permissions: any, message: Message, username?: string, userdata?: any, callback?: PermissionCallback) {
    const permission = new ConfigPermission(options.config.permission.options, options.services, options.config, permissions)
    permission.setRecordHandler({
      removeRecordRequest: () => {},
      runWhenRecordStable: (r: any, c: any) => { c(r) }
    })
    let permissionResult

    const socketWrapper = SocketWrapperFactoryMock.createSocketWrapper()
    socketWrapper.userId = username || 'someUser'
    socketWrapper.serverData = userdata
    callback = callback || function (sw: SocketWrapper, msg: Message, passItOn: any, error: any, result: boolean) {
      permissionResult = result
    }
    permission.canPerformAction(socketWrapper, message, callback)
    return permissionResult
  }
}
