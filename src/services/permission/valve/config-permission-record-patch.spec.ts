import 'mocha'
import { expect } from 'chai'

import * as C from '../../../constants'
import * as testHelper from '../../../test/helper/test-helper'

const noop = function () {}

const options = testHelper.getDeepstreamPermissionOptions()
const services = options.services
const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return services.logger.logSpy.lastCall.args[2]
}

describe('constructs data for patch message validation', () => {
  it('fails to set incorrect data', (next) => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    services.cache.set('user/wh', 0, { firstname: 'Wolfram', lastname: 'Something Else' }, noop)

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.PATCH,
      name: 'user/wh',
      version: 123,
      path: 'lastname',
      data: '"Miller"'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('succeeds if both old and new data is correct', (next) => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    services.cache.set('user/wh', 1, { firstname: 'Wolfram', lastname: 'Something Else' }, noop)

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.PATCH,
      name: 'user/wh',
      version: 123,
      path: 'lastname',
      data: '"Hempel"'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('errors if the patch message has data with an invalid json', (next) => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.PATCH,
      name: 'user/wh',
      version: 123,
      path: 'lastname',
      data: '['
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('SyntaxError: Unexpected end of JSON input')
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('returns false if patch if for a non existing record', (next) => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['*'].write = 'data.lastname === "Blob"'

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.PATCH,
      name: 'somerecord',
      version: 1,
      path: 'lastname',
      data: '"Hempel"'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('Tried to apply patch to non-existant record somerecord')
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })
})
