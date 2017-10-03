/* eslint-disable no-param-reassign */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../src/constants')
const testHelper = require('../test-helper/test-helper')

const options = testHelper.getDeepstreamPermissionOptions()
const testPermission = testHelper.testPermission(options)

describe('allows to create a record without providing data, but denies updating it', () => {
  const permissions = getBasePermissions()
  permissions.record['some/*'] = {
    write: 'data.name === "Wolfram"'
  }

  it('allows creating the record', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.CREATEORREAD,
      name: 'some/tests'
    }

    expect(testPermission(permissions, message)).toBe(true)
    options.services.cache.set('some/tests', {}, () => {})
  })

  it('denies update', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'some/tests',
      version: 2,
      data: '{"other":"data"}'
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
      name: 'some/tests',
      version: 2,
      path: 'apath',
      data: 'SaValue'
    }

    const callback = function (error, result) {
      expect(error).toBeNull()
      expect(result).toBe(false)
    }

    testPermission(permissions, message, 'some-user', null, callback)
  })
})
