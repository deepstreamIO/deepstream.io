/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ConfigPermissionHandler = require('../../src/permission/config-permission-handler')
const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../src/constants/constants')
const StorageMock = require('../mocks/storage-mock')

const options = {
  logger: { log: jasmine.createSpy('log') },
  cache: new StorageMock(),
  storage: new StorageMock(),
  permission: {
    options: {
      cacheEvacuationInterval: 60000
    }
  }
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

describe('allows to create a record without providing data, but denies updating it', () => {
  const permissions = getBasePermissions()
  permissions.record['some/*'] = {
    write: 'data.name === "Wolfram"'
  }

  it('allows creating the record', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.CREATEORREAD,
      data: ['some/tests']
    }

    expect(testPermission(permissions, message)).toBe(true)
    options.cache.set('some/tests', {}, () => {})
  })

  it('denies update', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      data: ['some/tests', 2, '{"other":"data"}']
    }

    const callback = function (error, result) {
      expect(error).toBeNull()
      expect(result).toBe(false)
    }

    testPermission(permissions, message, 'some-user', null, callback)
  })

  it('denies patch', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.PATCH,
      data: ['some/tests', 2, 'apath', 'SaValue']
    }

    const callback = function (error, result) {
      expect(error).toBeNull()
      expect(result).toBe(false)
    }

    testPermission(permissions, message, 'some-user', null, callback)
  })
})
