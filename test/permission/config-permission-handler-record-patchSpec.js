/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ConfigPermissionHandler = require('../../src/permission/config-permission-handler')
const StorageMock = require('../mocks/storage-mock')
const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../src/constants/constants')
const noop = function () {}
const options = {
  logger: { log: jasmine.createSpy('log') },
  cache: new StorageMock(),
  storage: new StorageMock(),
  cacheRetrievalTimeout: 500,
  permission: {
    options: {
      cacheEvacuationInterval: 60000,
      maxRuleIterations: 3,
    }
  }
}
const lastError = function () {
  return options.logger.log.calls.mostRecent().args[2]
}

const testPermission = function (permissions, message, username, userdata, callback) {
  const permissionHandler = new ConfigPermissionHandler(options, permissions)
  permissionHandler.setRecordHandler({ removeRecordRequest: () => {}, runWhenRecordStable: (r, c) => { c(r) } })
  let permissionResult

  username = username || 'someUser'
  userdata = userdata || {}
  callback = callback || function (error, result) {
    permissionResult = result
  }
  permissionHandler.canPerformAction(username, message, callback, userdata)
  return permissionResult
}

describe('constructs data for patch message validation', () => {
  it('fails to set incorrect data', (next) => {
    const permissions = getBasePermissions()
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    options.cache.set('user/wh', { firstname: 'Wolfram', lastname: 'Something Else' }, noop)

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.PATCH,
      data: ['user/wh', 123, 'lastname', 'SMiller']
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('succeeds if both old and new data is correct', (next) => {
    const permissions = getBasePermissions()
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    options.cache.set('user/wh', { firstname: 'Wolfram', lastname: 'Something Else' }, noop)

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.PATCH,
      data: ['user/wh', 123, 'lastname', 'SHempel']
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('errors if the patch message has invalid data', (next) => {
    const permissions = getBasePermissions()
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.PATCH,
      data: ['user/wh', 123]
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('Invalid message data')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('errors if the patch message has data with an invalid type', (next) => {
    const permissions = getBasePermissions()
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.PATCH,
      data: ['user/wh', 123, 'lastname', 'QHempel']
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('Unknown type')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('returns false if patch if for a non existing record', (next) => {
    const permissions = getBasePermissions()
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['*'].write = 'data.lastname === "Blob"'

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.PATCH,
      data: ['somerecord', 1, 'lastname', 'SHempel']
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('Tried to apply patch to non-existant record somerecord')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })
})
