/* eslint-disable no-param-reassign */
'use strict'

const C = require('../../src/constants')
const SocketWrapperFactory = require('../../src/message/uws/socket-wrapper-factory')

exports.msg = function () {
  const args = Array.from(arguments)
  const result = []
  let i

  for (i = 0; i < args.length; i++) {
    result.push(args[i]
      .replace(/\|/g, C.MESSAGE_PART_SEPERATOR)
      .replace(/\+/g, C.MESSAGE_SEPERATOR)
    )
  }

  return result.join(C.MESSAGE_SEPERATOR)
}

exports.showChars = function (input) {
  return input
    .replace(new RegExp(String.fromCharCode(31), 'g'), '|')
    .replace(new RegExp(String.fromCharCode(30), 'g'), '+')
}

exports.getBasePermissions = function () {
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

const MessageConnectorMock = require('../test-mocks/message-connector-mock')
const LoggerMock = require('../test-mocks/logger-mock')
const StorageMock = require('../test-mocks/storage-mock')

exports.getDeepstreamOptions = function (serverName) {
  const config = {
    serverName: serverName || 'server-name-a',
    stateReconciliationTimeout: 50,
    cacheRetrievalTimeout: 30,
    storageRetrievalTimeout: 50,
    storageExclusion: new RegExp('no-storage'),
    storageHotPathPatterns: [],
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

exports.getDeepstreamPermissionOptions = function () {
  const options = exports.getDeepstreamOptions()
  options.config = Object.assign(options.config, {
    cacheRetrievalTimeout: 500,
  })
  return { config: options.config, services: options.services }
}

const ConfigPermissionHandler = require('../../src/permission/config-permission-handler').default

exports.testPermission = function (options) {
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
      username, message, callback, userdata, SocketWrapperFactory.createSocketWrapper()
    )
    return permissionResult
  }
}
