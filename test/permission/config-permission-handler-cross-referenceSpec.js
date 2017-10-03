/* eslint-disable no-param-reassign */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach, beforeAll */
'use strict'

const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../dist/src/constants')
const testHelper = require('../test-helper/test-helper')

const noop = function () {}
const options = testHelper.getDeepstreamPermissionOptions()
const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return options.services.logger.log.calls.mostRecent().args[2]
}

describe('permission handler loads data for cross referencing', () => {
  beforeAll((next) => {
    options.services.cache.set('item/doesExist', { isInStock: true }, next)
  })

  it('retrieves an existing record from a synchronous cache', (next) => {
    const permissions = getBasePermissions()
    options.services.cache.nextGetWillBeSynchronous = true

    permissions.record['purchase/$itemId'] = {
      read: '_("item/" + $itemId).isInStock === true'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'purchase/doesExist'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(options.services.cache.lastRequestedKey).toBe('item/doesExist')
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('retrieves two records from the cache for crossreferencing purposes', (next) => {
    const permissions = getBasePermissions()

    options.services.cache.set('item/itemA', { isInStock: true }, noop)
    options.services.cache.set('item/itemB', { isInStock: false }, noop)

    options.services.cache.nextGetWillBeSynchronous = false
    permissions.record['purchase/$itemId'] = {
      read: '_("item/" + $itemId).isInStock === true && _("item/itemB").isInStock === false'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'purchase/itemA'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('retrieves and expects a non existing record', (next) => {
    const permissions = getBasePermissions()

    options.services.cache.nextGetWillBeSynchronous = false
    permissions.record['purchase/$itemId'] = {
      read: '_("doesNotExist") !== null && _("doesNotExist").isInStock === true'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'purchase/itemA'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('gets a non existant record thats not expected', (next) => {
    const permissions = getBasePermissions()

    options.services.cache.nextGetWillBeSynchronous = false
    permissions.record['purchase/$itemId'] = {
      read: '_("doesNotExist").isInStock === true'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'purchase/itemA'
    }

    const onDone = function (error, result) {
      expect(lastError()).toContain('TypeError: Cannot read property \'isInStock\' of null')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('mixes old data and cross references', (next) => {
    const permissions = getBasePermissions()
    options.services.cache.reset()
    options.services.cache.set('userA', { firstname: 'Egon' }, noop)
    options.services.cache.set('userB', { firstname: 'Mike' }, noop)
    options.services.cache.nextGetWillBeSynchronous = false
    permissions.record.userA = {
      read: 'oldData.firstname === "Egon" && _("userB").firstname === "Mike"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'userA'
    }

    const onDone = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      expect(options.services.cache.getCalls.length).toBe(2)
      expect(options.services.cache.hadGetFor('userA')).toBe(true)
      expect(options.services.cache.hadGetFor('userB')).toBe(true)
      setTimeout(next, 200)
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('retrieves keys from variables', (next) => {
    const permissions = getBasePermissions()

    options.services.cache.set('userX', { firstname: 'Joe' }, noop)

    permissions.event['some-event'] = {
      publish: '_(data.owner).firstname === "Joe"'
    }

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'O{"owner":"userX"}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }

    const callback = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      next()
    }

    testPermission(permissions, message, 'username', null, callback)
  })

  it('retrieves keys from variables again', (next) => {
    const permissions = getBasePermissions()

    options.services.cache.set('userX', { firstname: 'Mike' }, noop)

    permissions.event['some-event'] = {
      publish: '_(data.owner).firstname === "Joe"'
    }

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'O{"owner":"userX"}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }

    const callback = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, 'username', null, callback)
  })

  it('handles load errors', (next) => {
    const permissions = getBasePermissions()

    permissions.event['some-event'] = {
      publish: '_("bla") < 10'
    }
    options.services.cache.nextOperationWillBeSuccessful = false

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'O{"price":15}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }

    const callback = function (error, result) {
      expect(error).toContain('RECORD_LOAD_ERROR')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, 'username', null, callback)
  })
})
