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
import { DeepstreamConfig, DeepstreamServices, SocketWrapper, Monitoring, DeepstreamPlugin, PermissionCallback, UserAuthData } from '../../types'
import { SubscriptionRegistryFactory } from '../../utils/SubscriptionRegistryFactory'
import { Message, LOG_LEVEL, EVENT } from '../../constants'

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
    public isReady: boolean
    public description: string
    public nextResult: boolean
    public nextError: string | null

    constructor () {
      super()
      this.isReady = true
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
    public isReady = true
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
    message: new MessageConnectorMock(config),
    // @ts-ignore
    locks: {
      get (name, cb) { cb(true) },
      release () {}
    },
    monitoring: new MonitoringMock(),
    authenticationHandler: new AuthenticationHandler(),
    permissionHandler: new PermissionHandler(),
    connectionEndpoints: [],
  }
  services.subscriptions = new SubscriptionRegistryFactory(config, services as DeepstreamServices)
  return { config, services } as { config: DeepstreamConfig, services: DeepstreamServices}
}

export const getDeepstreamPermissionOptions = function () {
  const options = exports.getDeepstreamOptions()
  options.config = Object.assign(options.config, {
    cacheRetrievalTimeout: 500,
  })
  return { config: options.config, services: options.services }
}

const ConfigPermissionHandler = require('../../permission/config-permission-handler').default

export const testPermission = function (options: { config: DeepstreamConfig, services: DeepstreamServices }) {
  return function (permissions: any, message: Message, username: string, userdata: UserAuthData, callback: PermissionCallback) {
    const permissionHandler = new ConfigPermissionHandler(options.config.permission.options, options.services, options.config, permissions)
    permissionHandler.setRecordHandler({
      removeRecordRequest: () => {},
      runWhenRecordStable: (r: any, c: any) => { c(r) }
    })
    let permissionResult

    username = username || 'someUser'
    userdata = userdata || {}
    callback = callback || function (socketWrapper: SocketWrapper, msg: Message, passItOn: any, error: Error, result: boolean) {
      permissionResult = result
    }
    permissionHandler.canPerformAction(
      username, message, callback, userdata, SocketWrapperFactoryMock.createSocketWrapper()
    )
    return permissionResult
  }
}
