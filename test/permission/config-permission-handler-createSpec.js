/* eslint-disable no-param-reassign */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../src/constants/constants')
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
