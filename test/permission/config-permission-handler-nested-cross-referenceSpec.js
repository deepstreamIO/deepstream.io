/* no-param-reassign no-param-reassign, no-new, max-len, */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'
/* eslint-disable no-param-reassign */

const testHelper = require('../test-helper/test-helper')
const C = require('../../src/constants/constants')

const noop = function () {}
const options = testHelper.getDeepstreamPermissionOptions()
const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return options.logger.log.calls.mostRecent().args[2]
}

describe('permission handler loads data for cross referencing', () => {
  it('retrieves data for a nested cross references', (next) => {
    const permissions = testHelper.getBasePermissions()

    options.cache.set('thing/x', { ref: 'y' }, noop)
    options.cache.set('thing/y', { is: 'it' }, noop)

    options.cache.nextGetWillBeSynchronous = false
    permissions.record['test-record'] = {
      read: '_( "thing/" + _( "thing/x" ).ref ).is === "it"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      data: ['test-record']
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(options.cache.getCalls.length).toBe(2)
      expect(options.cache.hadGetFor('thing/x')).toBe(true)
      expect(options.cache.hadGetFor('thing/y')).toBe(true)
      expect(options.cache.hadGetFor('thing/z')).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('erors for undefined fields in crossreferences', (next) => {
    const permissions = testHelper.getBasePermissions()

    options.cache.set('thing/x', { ref: 'y' }, noop)
    options.cache.set('thing/y', { is: 'it' }, noop)

    options.cache.nextGetWillBeSynchronous = false
    permissions.record['test-record'] = {
      read: '_( "thing/" + _( "thing/x" ).doesNotExist ).is === "it"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      data: ['test-record']
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('Cannot read property \'is\' of undefined')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('can use the same cross reference multiple times', (next) => {
    const permissions = testHelper.getBasePermissions()

    options.cache.reset()
    options.cache.set('user', { firstname: 'Wolfram', lastname: 'Hempel' }, noop)
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['test-record'] = {
      read: '_("user").firstname === "Wolfram" && _("user").lastname === "Hempel"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      data: ['test-record']
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(options.cache.getCalls.length).toBe(1)
      expect(options.cache.hadGetFor('user')).toBe(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('supports nested references to the same record', (next) => {
    const permissions = testHelper.getBasePermissions()

    options.cache.reset()
    options.cache.set('user', { ref: 'user', firstname: 'Egon' }, noop)
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['test-record'] = {
      read: '_(_("user").ref).firstname === "Egon"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      data: ['test-record']
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(options.cache.getCalls.length).toBe(1)
      expect(options.cache.hadGetFor('user')).toBe(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('errors for objects as cross reference arguments', (next) => {
    const permissions = testHelper.getBasePermissions()

    options.cache.reset()
    options.cache.set('user', { ref: { bla: 'blub' } }, noop)
    options.cache.nextGetWillBeSynchronous = false

    permissions.record['test-record'] = {
      read: '_(_("user").ref).firstname === "Egon"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      data: ['test-record']
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('crossreference got unsupported type object')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('prevents nesting beyond limit', (next) => {
    const permissions = testHelper.getBasePermissions()

    options.cache.reset()
    options.cache.set('a', 'a', noop)
    options.cache.set('ab', 'b', noop)
    options.cache.set('abc', 'c', noop)
    options.cache.set('abcd', 'd', noop)
    options.cache.set('abcde', 'e', noop)
    options.cache.nextGetWillBeSynchronous = false
    permissions.record['test-record'] = {
      read: '_(_(_(_(_("a")+"b")+"c")+"d")+"e")'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      data: ['test-record']
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('Exceeded max iteration count')
      expect(result).toBe(false)
      expect(options.cache.getCalls.length).toBe(3)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })
})
