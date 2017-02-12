/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ConfigPermissionHandler = require('../../src/permission/config-permission-handler')
const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../src/constants/constants')
const options = {
  logger: { log: jasmine.createSpy('log') },
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

describe('supports spaces after variables and escaped quotes', () => {
  it('errors for read with data', () => {
    const permissions = getBasePermissions()
    permissions.record.someUser = {
      read: 'data.firstname === "Yasser"',
      write: 'data .firstname === "Yasser"'
    }

    try {
      new ConfigPermissionHandler(options, permissions)
    } catch (e) {
      expect(e.toString()).toContain('invalid permission config - rule read for record does not support data')
    }
  })

  it('allows yasser', (next) => {
    const permissions = getBasePermissions()
    permissions.record.someUser = {
      write: 'data .firstname === "Yasser"'
    }
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      data: ['someUser', 1, '{"firstname":"Yasser"}']
    }

    const callback = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      next()
    }

    testPermission(permissions, message, 'Yasser', null, callback)
  })

  it('denies Wolfram', (next) => {
    const permissions = getBasePermissions()
    permissions.record.someUser = {
      write: 'data .firstname === "Yasser"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      data: ['someUser', 1, '{"firstname":"Wolfram"}']
    }

    const callback = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, 'Yasser', null, callback)
  })
})
