import 'mocha'
import { expect } from 'chai'

import * as testHelper from '../../../test/helper/test-helper'
import * as C from '../../../constants'

const noop = function () {}
const options = testHelper.getDeepstreamPermissionOptions()
const services = options.services
const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return services.logger.logSpy.lastCall.args[2]
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
      action: C.RECORD_ACTION.READ,
      name: 'test-record'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      expect(services.cache.getCalls.length).to.equal(2)
      expect(services.cache.hadGetFor('thing/x')).to.equal(true)
      expect(services.cache.hadGetFor('thing/y')).to.equal(true)
      expect(services.cache.hadGetFor('thing/z')).to.equal(false)
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
      action: C.RECORD_ACTION.READ,
      name: 'test-record'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('Cannot read property \'is\' of undefined')
      expect(result).to.equal(false)
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
      action: C.RECORD_ACTION.READ,
      name: 'test-record'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      expect(services.cache.getCalls.length).to.equal(1)
      expect(services.cache.hadGetFor('user')).to.equal(true)
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
      action: C.RECORD_ACTION.READ,
      name: 'test-record'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      expect(services.cache.getCalls.length).to.equal(1)
      expect(services.cache.hadGetFor('user')).to.equal(true)
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
      action: C.RECORD_ACTION.READ,
      name: 'test-record'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('crossreference got unsupported type object')
      expect(result).to.equal(false)
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
      action: C.RECORD_ACTION.READ,
      name: 'test-record'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('Exceeded max iteration count')
      expect(result).to.equal(false)
      expect(services.cache.getCalls.length).to.equal(3)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })
})
