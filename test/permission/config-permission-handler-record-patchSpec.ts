import * as C from '../../src/constants'
const testHelper = require('../test-helper/test-helper')

const noop = function () {}

const options = testHelper.getDeepstreamPermissionOptions()
const services = options.services
const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return services.logger._log.calls.mostRecent().args[2]
}

describe('constructs data for patch message validation', () => {
  it('fails to set incorrect data', next => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    services.cache.set('user/wh', { firstname: 'Wolfram', lastname: 'Something Else' }, noop)

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.PATCH,
      name: 'user/wh',
      version: 123,
      path: 'lastname',
      data: '"Miller"'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('succeeds if both old and new data is correct', next => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    services.cache.set('user/wh', { firstname: 'Wolfram', lastname: 'Something Else' }, noop)

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.PATCH,
      name: 'user/wh',
      version: 123,
      path: 'lastname',
      data: '"Hempel"'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('errors if the patch message has data with an invalid json', next => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['user/wh'] = {
      write: 'data.firstname === "Wolfram" && data.lastname === "Hempel"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.PATCH,
      name: 'user/wh',
      version: 123,
      path: 'lastname',
      data: '['
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('SyntaxError: Unexpected end of JSON input')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('returns false if patch if for a non existing record', next => {
    const permissions = testHelper.getBasePermissions()
    services.cache.nextGetWillBeSynchronous = false

    permissions.record['*'].write = 'data.lastname === "Blob"'

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.PATCH,
      name: 'somerecord',
      version: 1,
      path: 'lastname',
      data: '"Hempel"'
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('Tried to apply patch to non-existant record somerecord')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })
})
