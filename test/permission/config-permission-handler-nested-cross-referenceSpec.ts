'use strict'

const testHelper = require('../test-helper/test-helper')
import * as C from '../../src/constants'

const noop = function () {}
const options = testHelper.getDeepstreamPermissionOptions()
const services = options.services
const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return services.logger._log.calls.mostRecent().args[2]
}

describe('permission handler loads data for cross referencing', () => {
  it('retrieves data for a nested cross references', (next) => {
    const permissions = testHelper.getBasePermissions()

    services.cache.set('thing/x', 0, { ref: 'y' }, noop)
    services.cache.set('thing/y', 0, { is: 'it' }, noop)

    services.cache.nextGetWillBeSynchronous = false
    permissions.record['test-record'] = {
      read: '_( "thing/" + _( "thing/x" ).ref ).is === "it"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.READ,
      name: 'test-record'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(services.cache.getCalls.length).toBe(2)
      expect(services.cache.hadGetFor('thing/x')).toBe(true)
      expect(services.cache.hadGetFor('thing/y')).toBe(true)
      expect(services.cache.hadGetFor('thing/z')).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('erors for undefined fields in crossreferences', (next) => {
    const permissions = testHelper.getBasePermissions()

    services.cache.set('thing/x', 0, { ref: 'y' }, noop)
    services.cache.set('thing/y', 0, { is: 'it' }, noop)

    services.cache.nextGetWillBeSynchronous = false
    permissions.record['test-record'] = {
      read: '_( "thing/" + _( "thing/x" ).doesNotExist ).is === "it"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.READ,
      name: 'test-record'
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

    services.cache.reset()
    services.cache.set('user', 0, { firstname: 'Wolfram', lastname: 'Hempel' }, noop)
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['test-record'] = {
      read: '_("user").firstname === "Wolfram" && _("user").lastname === "Hempel"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.READ,
      name: 'test-record'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(services.cache.getCalls.length).toBe(1)
      expect(services.cache.hadGetFor('user')).toBe(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('supports nested references to the same record', (next) => {
    const permissions = testHelper.getBasePermissions()

    services.cache.reset()
    services.cache.set('user', 0, { ref: 'user', firstname: 'Egon' }, noop)
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['test-record'] = {
      read: '_(_("user").ref).firstname === "Egon"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.READ,
      name: 'test-record'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(services.cache.getCalls.length).toBe(1)
      expect(services.cache.hadGetFor('user')).toBe(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('errors for objects as cross reference arguments', (next) => {
    const permissions = testHelper.getBasePermissions()

    services.cache.reset()
    services.cache.set('user', 0, { ref: { bla: 'blub' } }, noop)
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['test-record'] = {
      read: '_(_("user").ref).firstname === "Egon"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.READ,
      name: 'test-record'
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

    services.cache.reset()
    services.cache.set('a', 0, 'a', noop)
    services.cache.set('ab', 0, 'b', noop)
    services.cache.set('abc', 0, 'c', noop)
    services.cache.set('abcd', 0, 'd', noop)
    services.cache.set('abcde', 0, 'e', noop)
    services.cache.nextGetWillBeSynchronous = false
    permissions.record['test-record'] = {
      read: '_(_(_(_(_("a")+"b")+"c")+"d")+"e")'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.READ,
      name: 'test-record'
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('Exceeded max iteration count')
      expect(result).toBe(false)
      expect(services.cache.getCalls.length).toBe(3)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })
})
