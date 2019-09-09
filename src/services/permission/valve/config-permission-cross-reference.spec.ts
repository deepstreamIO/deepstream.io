import 'mocha'
import { expect } from 'chai'

import * as C from '../../../constants'

import { getBasePermissions } from '../../../test/helper/test-helper'
import * as testHelper from '../../../test/helper/test-helper'

const noop = function () {}
const options = testHelper.getDeepstreamPermissionOptions()
const services = options.services
const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return services.logger.logSpy.lastCall.args[2]
}

describe('permission handler loads data for cross referencing', () => {
  before((next) => {
    services.cache.set('item/doesExist', 0, { isInStock: true }, next)
  })

  it('retrieves an existing record from a synchronous cache', (next) => {
    const permissions = getBasePermissions()
    services.cache.nextGetWillBeSynchronous = true

    permissions.record['purchase/$itemId'] = {
      read: '_("item/" + $itemId).isInStock === true'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'purchase/doesExist'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      expect(services.cache.lastRequestedKey).to.equal('item/doesExist')
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('retrieves two records from the cache for cross referencing purposes', (next) => {
    const permissions = getBasePermissions()

    services.cache.set('item/itemA', 0, { isInStock: true }, noop)
    services.cache.set('item/itemB', 0, { isInStock: false }, noop)

    services.cache.nextGetWillBeSynchronous = false
    permissions.record['purchase/$itemId'] = {
      read: '_("item/" + $itemId).isInStock === true && _("item/itemB").isInStock === false'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'purchase/itemA'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('retrieves and expects a non existing record', (next) => {
    const permissions = getBasePermissions()

    services.cache.nextGetWillBeSynchronous = false
    permissions.record['purchase/$itemId'] = {
      read: '_("doesNotExist") !== null && _("doesNotExist").isInStock === true'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'purchase/itemA'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('gets a non existant record thats not expected', (next) => {
    const permissions = getBasePermissions()

    services.cache.nextGetWillBeSynchronous = false
    permissions.record['purchase/$itemId'] = {
      read: '_("doesNotExist").isInStock === true'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'purchase/itemA'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('TypeError: Cannot read property \'isInStock\' of null')
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('mixes old data and cross references', (next) => {
    const permissions = getBasePermissions()
    services.cache.reset()
    services.cache.set('userA', 0, { firstname: 'Egon' }, noop)
    services.cache.set('userB', 0, { firstname: 'Mike' }, noop)
    services.cache.nextGetWillBeSynchronous = false
    permissions.record.userA = {
      read: 'oldData.firstname === "Egon" && _("userB").firstname === "Mike"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'userA'
    }

    const onDone = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      expect(services.cache.getCalls.length).to.equal(2)
      expect(services.cache.hadGetFor('userA')).to.equal(true)
      expect(services.cache.hadGetFor('userB')).to.equal(true)
      setTimeout(next, 200)
    }

    testPermission(permissions, message, null, null, onDone)
  })

  it('retrieves keys from name', (next) => {
    const permissions = getBasePermissions()

    services.cache.set('some-event', 0, { firstname: 'Joe' }, noop)

    permissions.event['some-event'] = {
      publish: '_(name).firstname === "Joe"'
    }

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      next()
    }

    testPermission(permissions, message, 'username', null, callback)
  })

  it('retrieves keys from variables', (next) => {
    const permissions = getBasePermissions()

    services.cache.set('userX', 0, { firstname: 'Joe' }, noop)

    permissions.event['some-event'] = {
      publish: '_(data.owner).firstname === "Joe"'
    }

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: '{"owner":"userX"}'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      next()
    }

    testPermission(permissions, message, 'username', null, callback)
  })

  it('retrieves keys from variables again', (next) => {
    const permissions = getBasePermissions()

    services.cache.set('userX', 0, { firstname: 'Mike' }, noop)

    permissions.event['some-event'] = {
      publish: '_(data.owner).firstname === "Joe"'
    }

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: '{"owner":"userX"}'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'username', null, callback)
  })

  it('handles load errors', (next) => {
    const permissions = getBasePermissions()

    permissions.event['some-event'] = {
      publish: '_("bla") < 10'
    }
    services.cache.nextOperationWillBeSuccessful = false

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: '{"price":15}'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(C.RECORD_ACTION.RECORD_LOAD_ERROR)
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'username', null, callback)
  })
})
