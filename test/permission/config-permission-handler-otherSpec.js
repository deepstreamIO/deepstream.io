/* eslint-disable no-param-reassign, no-new, max-len, */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../src/constants/constants')
const testHelper = require('../test-helper/test-helper')
const ConfigPermissionHandler = require('../../src/permission/config-permission-handler')

const options = testHelper.getDeepstreamPermissionOptions()
const testPermission = testHelper.testPermission(options)

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
