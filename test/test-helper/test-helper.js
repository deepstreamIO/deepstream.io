/* eslint-disable no-param-reassign, prefer-rest-params */
/* global jasmine */
'use strict'

const C = require('../../src/constants/constants')

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

const MessageConnectorMock = require('../mocks/message-connector-mock')
const LoggerMock = require('../mocks/logger-mock')
const StorageMock = require('../mocks/storage-mock')

exports.getDeepstreamOptions = function (serverName) {
  const options = {
    serverName: serverName || 'server-name-a',
    stateReconciliationTimeout: 10,
    logger: new LoggerMock(),
    storageExclusion: new RegExp('no-storage'),
    cache: new StorageMock(),
    storage: new StorageMock(),
    storageHotPathPatterns: [],
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
  options.message = new MessageConnectorMock(options)
  options.uniqueRegistry = {
    get (name, cb) { cb(true) },
    release () {}
  }
  return options
}

exports.getDeepstreamPermissionOptions = function () {
  let options = exports.getDeepstreamOptions()
  options = Object.assign(options, {
    logger: new LoggerMock(),
    cacheRetrievalTimeout: 500,
    permission: {
      options: {
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 3
      }
    }
  })
  return options
}

const ConfigPermissionHandler = require('../../src/permission/config-permission-handler')

exports.testPermission = function (options) {
  return function (permissions, message, username, userdata, callback) {
    const permissionHandler = new ConfigPermissionHandler(options, permissions)
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
    permissionHandler.canPerformAction(username, message, callback, userdata)
    return permissionResult
  }
}
