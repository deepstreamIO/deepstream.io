import * as SocketWrapperFactoryMock from '../test-mocks/socket-wrapper-factory-mock'

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

import MessageConnectorMock from '../test-mocks/message-connector-mock'
import LoggerMock from '../test-mocks/logger-mock'
import StorageMock from '../test-mocks/storage-mock'

export const getDeepstreamOptions = function (serverName) {
  const config = {
    serverName: serverName || 'server-name-a',
    stateReconciliationTimeout: 50,
    cacheRetrievalTimeout: 30,
    storageRetrievalTimeout: 50,
    storageExclusionPrefixes: ['no-storage'],
    storageHotPathPrefixes: [],
    permission: {
      options: {
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 3
      }
    }
  }
  const services = {
    logger: new LoggerMock(),
    cache: new StorageMock(),
    storage: new StorageMock(),
    message: new MessageConnectorMock(config),
    uniqueRegistry: {
      get (name, cb) { cb(true) },
      release () {}
    },
    permissionHandler: {
      nextResult: true,
      nextError: null,
      lastArgs: [],
      canPerformAction (a, b, c) {
        this.lastArgs.push([a, b, c])
        c(this.nextError, this.nextResult)
      }
    }
  }
  return { config, services }
}

export const getDeepstreamPermissionOptions = function () {
  const options = exports.getDeepstreamOptions()
  options.config = Object.assign(options.config, {
    cacheRetrievalTimeout: 500,
  })
  return { config: options.config, services: options.services }
}

const ConfigPermissionHandler = require('../../src/permission/config-permission-handler').default

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
