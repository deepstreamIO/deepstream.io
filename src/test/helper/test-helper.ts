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
import { InternalDeepstreamConfig, DeepstreamServices } from '../../types'
import { SubscriptionRegistryFactory } from '../../utils/SubscriptionRegistryFactory'

export const getDeepstreamOptions = (serverName?: string): { config: InternalDeepstreamConfig, services: DeepstreamServices } => {
  const config: InternalDeepstreamConfig = { ...get(), ...{
    serverName: serverName || 'server-name-a',
    stateReconciliationTimeout: 50,
    cacheRetrievalTimeout: 30,
    storageRetrievalTimeout: 50,
    rpcAckTimeout: 10,
    rpcTimeout: 20,
    storageExclusionPrefixes: ['no-storage'],
    storageHotPathPrefixes: [],
    permission: {
      options: {
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 3
      }
    },
    provideRPCRequestorDetails: true,
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

    public canPerformAction (a, b, c) {
      this.lastArgs.push([a, b, c])
      c(this.nextError, this.nextResult)
    }
  }

  const services: Partial<DeepstreamServices> = {
    logger: new LoggerMock(),
    cache: new StorageMock(),
    storage: new StorageMock(),
    message: new MessageConnectorMock(config),
    uniqueRegistry: {
      get (name, cb) { cb(true) },
      release () {}
    },
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
      runWhenRecordStable: (r, c) => { c(r) }
    })
    let permissionResult

    username = username || 'someUser'
    userdata = userdata || {}
    callback = callback || function (error, result) {
      permissionResult = result
    }
    permissionHandler.canPerformAction(
      username, message, callback, userdata, SocketWrapperFactoryMock.createSocketWrapper()
    )
    return permissionResult
  }
}
