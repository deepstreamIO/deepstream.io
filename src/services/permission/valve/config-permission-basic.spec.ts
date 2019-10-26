import 'mocha'
import { expect } from 'chai'

import * as C from '../../../constants'
import { getBasePermissions } from '../../../test/helper/test-helper'
import * as testHelper from '../../../test/helper/test-helper'
import { ConfigPermission } from './config-permission'

const options = testHelper.getDeepstreamPermissionOptions()
const config = options.config
const services = options.services

const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return services.logger.logSpy.lastCall.args[2]
}

describe('permission handler applies basic permissions to incoming messages', () => {
  it('allows everything for a basic permission set', () => {
    const permissions = getBasePermissions()
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'someRecord'
    }
    expect(testPermission(permissions, message)).to.equal(true)
  })

  it('denies reading of a private record', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userB')).to.equal(false)
  })

  it('allows actions that dont need permissions for a private record', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UNSUBSCRIBE,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userB')).to.equal(true)
  })

  it('allows reading of a private record for the right user', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userA')).to.equal(true)
  })

  it('can reference the name', () => {
    const permissions = getBasePermissions()

    permissions.record['private/userA'] = {
      read: 'name === "private/userA"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userA')).to.equal(true)
  })

  it('denies snapshot of a private record', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userB')).to.equal(false)
  })
})

describe('permission handler applies basic permissions referencing their own data', () => {
  it('checks incoming data against a value for events', () => {
    const permissions = getBasePermissions()

    permissions.event['some-event'] = {
      publish: 'data.price < 10'
    }

    expect(testPermission(permissions, {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: '{"price":15}'
    })).to.equal(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: '{"price":5}'
    })).to.equal(true)
  })

  it('can reference data for events without a payload and fail normally', () => {
    const permissions = getBasePermissions()
    permissions.event['some-event'] = {
      publish: 'data.price < 10'
    }

    expect(testPermission(permissions, {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event'
    })).to.equal(false)
  })

  it('checks incoming data against a value for rpcs', () => {
    const permissions = getBasePermissions()

    permissions.rpc['*'] = {
      request: false
    }

    permissions.rpc['trade/book'] = {
      request: 'user.data.role === "fx-trader" && data.assetClass === "fx"'
    }

    expect(testPermission(permissions, {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.REQUEST,
      name: 'trade/book',
      correlationId: '1234',
      data: '{"assetClass": "equity"}'
    }, null, { role: 'eq-trader' })).to.equal(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.REQUEST,
      name: 'trade/book',
      correlationId: '1234',
      data: '{"assetClass": "fx"}'
    }, null, { role: 'fx-trader' })).to.equal(true)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.REQUEST,
      name: 'trade/book',
      correlationId: '1234',
      data: '{"assetClass": "fx"}'
    }, null, { role: 'eq-trader' })).to.equal(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.REQUEST,
      name: 'trade/cancel',
      correlationId: '1234',
      data: '{"assetClass": "fx"}'
    }, null, { role: 'fx-trader' })).to.equal(false)
  })

  it('checks incoming data against a value for record updates', () => {
    const permissions = getBasePermissions()

    permissions.record['cars/mercedes'] = {
      write: 'data.manufacturer === "mercedes-benz"'
    }

    permissions.record['cars/porsche/$model'] = {
      write: 'data.price > 50000 && data.model === $model'
    }

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'cars/mercedes',
      version: 1,
      data: '{"manufacturer":"mercedes-benz"}'
    })).to.equal(true)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'cars/mercedes',
      version: 1,
      data: '{"manufacturer":"BMW"}'
    })).to.equal(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'cars/porsche/911',
      version: 1,
      data: '{"model": "911", "price": 60000 }'
    })).to.equal(true)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'cars/porsche/911',
      version: 1,
      data: '{"model": "911", "price": 40000 }'
    })).to.equal(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'cars/porsche/911',
      version: 1,
      data: '{"model": "Boxter", "price": 70000 }'
    })).to.equal(false)
  })

  it.skip('checks against existing data for non-existant record reads', (next) => {
    const permissions = getBasePermissions()

    permissions.record['non-Existing-Record'] = {
      read: 'oldData.xyz === "hello"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'non-Existing-Record',
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('Cannot read property \'xyz\' of null')
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'user', null, callback)
  })

  it.skip('checks against existing data for non-existant list reads', (next) => {
    const permissions = getBasePermissions()

    permissions.record['non-Existing-Record'] = {
      read: 'oldData.indexOf("hello") !== -1'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.READ,
      name: 'non-Existing-Record',
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('Cannot read property \'indexOf\' of null')
      expect(error).to.equal(C.RECORD_ACTION.MESSAGE_PERMISSION_ERROR)
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'user', null, callback)

  })

  it('deals with broken messages', (next) => {
    const permissions = getBasePermissions()

    permissions.record['cars/mercedes'] = {
      write: 'data.manufacturer === "mercedes-benz"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'cars/mercedes',
      version: 1,
      data: '{"manufacturer":"mercedes-benz"'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('error when converting message data')
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'user', null, callback)
  })

  it('deals with messages with invalid types', (next) => {
    const permissions = getBasePermissions()

    permissions.event['some-event'] = {
      publish: 'data.manufacturer === "mercedes-benz"'
    }

    const message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: 'xxx'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(lastError()).to.contain('error when converting message data')
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'user', null, callback)
  })
})

describe('loads permissions repeatedly', () => {
  let permission

  it('creates the permission', async () => {
    permission = new ConfigPermission({ permissions: getBasePermissions() }, services, config)
    permission.setRecordHandler({
      removeRecordRequest: () => {},
      runWhenRecordStable: (r, c) => { c(r) }
    })
    await permission.whenReady()
  })

  it('requests permissions initially, causing a lookup', (next) => {
    const message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: 'some-data'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      next()
    }

    permission.canPerformAction('some-user', message, callback)
  })

  it('requests permissions a second time, causing a cache retrieval', (next) => {
    const message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTION.EMIT,
      name: 'some-event',
      data: 'some-data'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      next()
    }

    permission.canPerformAction('some-user', message, callback)
  })
})
