import * as SocketWrapperFactoryMock from '../mock/socket-wrapper-factory-mock'
import AuthenticationHandler from '../mock/authentication-handler-mock'

export const showChars = function (input) {
  return input
    .replace(new RegExp(String.fromCharCode(31), 'g'), '|')
    .replace(new RegExp(String.fromCharCode(30), 'g'), '+')
}

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
import { EventEmitter } from 'events'
import { InternalDeepstreamConfig, DeepstreamServices, MonitoringPlugin, SocketWrapper } from '../../types'
import { SubscriptionRegistryFactory } from '../../utils/SubscriptionRegistryFactory'
import { Message, LOG_LEVEL, EVENT } from '../../constants'

export const getDeepstreamOptions = (serverName?: string): { config: InternalDeepstreamConfig, services: DeepstreamServices } => {
  const config: InternalDeepstreamConfig = { ...get(), ...{
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
  }}

  class PermissionHandler extends EventEmitter {
    public lastArgs: any[]
    public isReady: boolean
    public description: string
    public nextResult: boolean
    public nextError: boolean | null

    constructor () {
      super()
      this.isReady = true
      this.description = 'Test Permission Handler'
      this.nextResult = true
      this.nextError = null
      this.lastArgs = []
    }

    public canPerformAction (user, message, callback, authData, socketWrapper, passItOn) {
      this.lastArgs.push([user, message, callback])
      callback(socketWrapper, message, passItOn, this.nextError, this.nextResult)
    }
  }

// tslint:disable-next-line: max-classes-per-file
  class MonitoringMock extends EventEmitter implements MonitoringPlugin {
    public isReady = true
    public apiVersion = 1
    public description: 'monitoring mock'
    constructor () {
      super()
    }
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
    locks: {
      get (name, cb) { cb(true) },
      release () {}
    },
    monitoring: new MonitoringMock(),
    authenticationHandler: new AuthenticationHandler(),
    permissionHandler: new PermissionHandler(),
    registeredPlugins: [],
    connectionEndpoints: [],
  }
  services.subscriptions = new SubscriptionRegistryFactory(config, services as DeepstreamServices)
  return { config, services } as { config: InternalDeepstreamConfig, services: DeepstreamServices}
}

export const getDeepstreamPermissionOptions = function () {
  const options = exports.getDeepstreamOptions()
  options.config = Object.assign(options.config, {
    cacheRetrievalTimeout: 500,
  })
  return { config: options.config, services: options.services }
}

const ConfigPermissionHandler = require('../../permission/config-permission-handler').default

export const testPermission = function (options) {
  return function (permissions, message, username, userdata, callback) {
    const permissionHandler = new ConfigPermissionHandler(options.config, options.services, permissions)
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
