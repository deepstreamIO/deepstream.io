'use strict'

const getBasePermissions = require('../test-helper/test-helper').getBasePermissions
const C = require('../../src/constants')
const testHelper = require('../test-helper/test-helper')
const ConfigPermissionHandler = require('../../src/permission/config-permission-handler').default

const options = testHelper.getDeepstreamPermissionOptions()
const config = options.config
const services = options.services

const testPermission = testHelper.testPermission(options)

const lastError = function () {
  return services.logger.log.calls.mostRecent().args[2]
}

describe('permission handler applies basic permissions to incoming messages', () => {
  it('allows everything for a basic permission set', () => {
    const permissions = getBasePermissions()
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'someRecord'
    }
    expect(testPermission(permissions, message)).toBe(true)
  })

  it('denies reading of a private record', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userB')).toBe(false)
  })

  it('allows actions that dont need permissions for a private record', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UNSUBSCRIBE,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userB')).toBe(true)
  })

  it('allows reading of a private record for the right user', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userA')).toBe(true)
  })

  it('denies snapshot of a private record', () => {
    const permissions = getBasePermissions()

    permissions.record['private/$userId'] = {
      read: 'user.id === $userId'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.SNAPSHOT,
      name: 'private/userA'
    }

    expect(testPermission(permissions, message, 'userB')).toBe(false)
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
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'O{"price":15}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    })).toBe(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'O{"price":5}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    })).toBe(true)
  })

  it('can reference data for events without a payload and fail normally', () => {
    const permissions = getBasePermissions()
    permissions.event['some-event'] = {
      publish: 'data.price < 10'
    }

    expect(testPermission(permissions, {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: 'some-event'
    })).toBe(false)
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
      action: C.ACTIONS.REQUEST,
      name: 'trade/book',
      correlationId: '1234',
      data: 'O{"assetClass": "equity"}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }, null, { role: 'eq-trader' })).toBe(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      name: 'trade/book',
      correlationId: '1234',
      data: 'O{"assetClass": "fx"}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }, null, { role: 'fx-trader' })).toBe(true)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      name: 'trade/book',
      correlationId: '1234',
      data: 'O{"assetClass": "fx"}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }, null, { role: 'eq-trader' })).toBe(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      name: 'trade/cancel',
      correlationId: '1234',
      data: 'O{"assetClass": "fx"}',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }, null, { role: 'fx-trader' })).toBe(false)
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
      action: C.ACTIONS.UPDATE,
      name: 'cars/mercedes',
      version: 1,
      data: '{"manufacturer":"mercedes-benz"}',
      dataEncoding: C.ENCODING_TYPES.JSON
    })).toBe(true)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'cars/mercedes',
      version: 1,
      data: '{"manufacturer":"BMW"}',
      dataEncoding: C.ENCODING_TYPES.JSON
    })).toBe(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'cars/porsche/911',
      version: 1,
      data: '{"model": "911", "price": 60000 }',
      dataEncoding: C.ENCODING_TYPES.JSON
    })).toBe(true)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'cars/porsche/911',
      version: 1,
      data: '{"model": "911", "price": 40000 }',
      dataEncoding: C.ENCODING_TYPES.JSON
    })).toBe(false)

    expect(testPermission(permissions, {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'cars/porsche/911',
      version: 1,
      data: '{"model": "Boxter", "price": 70000 }',
      dataEncoding: C.ENCODING_TYPES.JSON
    })).toBe(false)
  })

  it('deals with broken messages', (next) => {
    const permissions = getBasePermissions()

    permissions.record['cars/mercedes'] = {
      write: 'data.manufacturer === "mercedes-benz"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'cars/mercedes',
      version: 1,
      data: '{"manufacturer":"mercedes-benz"',
      dataEncoding: C.ENCODING_TYPES.JSON
    }

    const callback = function (error, result) {
      expect(lastError()).toContain('error when converting message data')
      expect(result).toBe(false)
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
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'xxx',
      dataEncoding: C.ENCODING_TYPES.DEEPSTREAM
    }

    const callback = function (error, result) {
      expect(lastError()).toContain('error when converting message data')
      expect(result).toBe(false)
      next()
    }

    testPermission(permissions, message, 'user', null, callback)
  })
})

describe('loads permissions repeatedly', () => {
  let permissionHandler

  it('creates the permissionHandler', () => {
    permissionHandler = new ConfigPermissionHandler(config, services, getBasePermissions())
    permissionHandler.setRecordHandler({
      removeRecordRequest: () => {},
      runWhenRecordStable: (r, c) => { c(r) }
    })
    expect(permissionHandler.isReady).toBe(true)
  })

  it('requests permissions initally, causing a lookup', (next) => {
    const message = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'some-data'
    }

    const callback = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      next()
    }

    permissionHandler.canPerformAction('some-user', message, callback)
  })

  it('requests permissions a second time, causing a cache retriaval', (next) => {
    const message = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: 'some-event',
      data: 'some-data'
    }

    const callback = function (error, result) {
      expect(error).toBe(null)
      expect(result).toBe(true)
      next()
    }

    permissionHandler.canPerformAction('some-user', message, callback)
  })
})
