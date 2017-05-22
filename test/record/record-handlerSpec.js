/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let proxyquire = require('proxyquire').noCallThru().noPreserveCache(),
  SocketWrapper = require('../mocks/socket-wrapper-mock'),
  SubscriptionRegistry = proxyquire('../../src/utils/subscription-registry', {
    '../message/uws-socket-wrapper': SocketWrapper
  }),
  RecordHandler = proxyquire('../../src/record/record-handler', {
    '../utils/subscription-registry': SubscriptionRegistry
  }),
  msg = require('../test-helper/test-helper').msg,
  StorageMock = require('../mocks/storage-mock'),
  SocketMock = require('../mocks/socket-mock'),
  LoggerMock = require('../mocks/logger-mock'),
  noopMessageConnector = require('../../src/default-plugins/noop-message-connector'),
  clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))()

describe('record handler handles messages', () => {
  let recordHandler,
    clientA = new SocketWrapper(new SocketMock(), {}),
    clientB = new SocketWrapper(new SocketMock(), {}),
    options = {
      clusterRegistry: clusterRegistryMock,
      cache: new StorageMock(),
      storage: new StorageMock(),
      storageExclusion: new RegExp('no-storage'),
      logger: new LoggerMock(),
      messageConnector: noopMessageConnector,
      permissionHandler: { canPerformAction(a, b, c) { c(null, true) } },
      uniqueRegistry: {
        get() {},
        release() {}
      }
    }

  it('creates the record handler', () => {
    recordHandler = new RecordHandler(options)
    expect(recordHandler.handle).toBeDefined()
  })

  it('rejects messages with invalid data', () => {
    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: []
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|raw-message+'))
  })

  it('handles unknown actions', () => {
    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'DOES_NOT_EXIST',
      data: ['someRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|UNKNOWN_ACTION|unknown action DOES_NOT_EXIST+'))
  })

  it('creates a non existing record', () => {
    recordHandler.handle(clientA, {
      topic: 'R',
      action: 'CR',
      data: ['someRecord']
    })

    expect(options.cache.lastSetKey).toBe('someRecord')
    expect(options.cache.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(options.storage.lastSetKey).toBe('someRecord')
    expect(options.storage.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|someRecord|0|{}+'))
  })

  it('tries to create a non existing record, but receives an error from the cache', () => {
    options.cache.failNextSet = true

    recordHandler.handle(clientA, {
      topic: 'R',
      action: 'CR',
      data: ['someRecord7']
    })

    expect(clientA.socket.sendMessages).toContain(msg('R|E|RECORD_CREATE_ERROR|someRecord7+'))
  })

  it('tries to create a non existing record, but receives an error from the cache', () => {
    options.storage.failNextSet = true
    options.logger.lastLogMessage = null
    recordHandler.handle(clientA, {
      topic: 'R',
      action: 'CR',
      data: ['someRecord8']
    })

    expect(options.logger.lastLogMessage).toBe('storage:storageError')
  })


  it('does not store new record when excluded', () => {
    options.storage.lastSetKey = null
    options.storage.lastSetValue = null

    recordHandler.handle(clientA, {
      topic: 'R',
      action: 'CR',
      data: ['no-storage']
    })

    expect(options.storage.lastSetKey).toBe(null)
    expect(options.storage.lastSetValue).toBe(null)
  })

  it('returns an existing record', () => {
    options.cache.set('existingRecord', { _v: 3, _d: { firstname: 'Wolfram' } }, () => {})
    recordHandler.handle(clientA, {
      topic: 'R',
      action: 'CR',
      data: ['existingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|existingRecord|3|{"firstname":"Wolfram"}+'))
  })

  it('returns true for HAS if message exists', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|H|existingRecord'),
      topic: 'R',
      action: 'H',
      data: ['existingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|H|existingRecord|T+'))
  })

  it('returns false for HAS if message doesn\'t exists', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|H|nonExistingRecord'),
      topic: 'R',
      action: 'H',
      data: ['nonExistingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|H|nonExistingRecord|F+'))
  })

  it('returns an error for HAS if message error occurs with record retrieval', () => {
    options.cache.nextOperationWillBeSuccessful = false

    recordHandler.handle(clientA, {
      raw: msg('R|H|existingRecord'),
      topic: 'R',
      action: 'H',
      data: ['existingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|H|existingRecord|RECORD_LOAD_ERROR+'))

    options.cache.nextOperationWillBeSuccessful = true
  })

  it('returns a snapshot of the data that exists with version number and data', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|SN|existingRecord'),
      topic: 'R',
      action: 'SN',
      data: ['existingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|existingRecord|3|{"firstname":"Wolfram"}+'))
  })


  it('returns an error for a snapshot of data that doesn\'t exists', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|SN|nonExistingRecord'),
      topic: 'R',
      action: 'SN',
      data: ['nonExistingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|SN|nonExistingRecord|RECORD_NOT_FOUND+'))
  })

  it('returns an error for a snapshot if message error occurs with record retrieval', () => {
    options.cache.nextOperationWillBeSuccessful = false

    recordHandler.handle(clientA, {
      raw: msg('R|SN|existingRecord'),
      topic: 'R',
      action: 'SN',
      data: ['existingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|SN|existingRecord|RECORD_LOAD_ERROR+'))

    options.cache.nextOperationWillBeSuccessful = true
  })


  it('returns a version of the data that exists with version number', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|HD|existingRecord'),
      topic: 'R',
      action: 'HD',
      data: ['existingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|HD|existingRecord|3+'))
  })


  it('returns an error for a head request of data that doesn\'t exists', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|HD|nonExistingRecord'),
      topic: 'R',
      action: 'HD',
      data: ['nonExistingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|HD|nonExistingRecord|RECORD_NOT_FOUND+'))
  })

  it('returns an error for a version if message error occurs with record retrieval', () => {
    options.cache.nextOperationWillBeSuccessful = false

    recordHandler.handle(clientA, {
      raw: msg('R|HD|existingRecord'),
      topic: 'R',
      action: 'HD',
      data: ['existingRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|HD|existingRecord|RECORD_LOAD_ERROR+'))

    options.cache.nextOperationWillBeSuccessful = true
  })

  it('patches a record', () => {
    recordHandler.handle(clientB, {
      raw: msg('R|P|existingRecord|4|lastname|SEgon'),
      topic: 'R',
      action: 'P',
      data: ['existingRecord', 4, 'lastname', 'SEgon']
    })

    expect(clientB.socket.lastSendMessage).toBe(null)
    expect(clientA.socket.lastSendMessage).toBe(msg('R|P|existingRecord|4|lastname|SEgon+'))
  })

  it('returns the patched record', () => {
    recordHandler.handle(clientB, {
      topic: 'R',
      action: 'CR',
      data: ['existingRecord']
    })

    expect(clientB.socket.lastSendMessage).toBe(msg('R|R|existingRecord|4|{"firstname":"Wolfram","lastname":"Egon"}+'))
  })

  it('updates a record', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|U|existingRecord|5|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 5, '{"name":"Kowalski"}']
    })

    expect(clientB.socket.lastSendMessage).toBe(msg('R|U|existingRecord|5|{"name":"Kowalski"}+'))
    options.cache.get('existingRecord', (error, record) => {
      expect(record).toEqual({ _v: 5, _d: { name: 'Kowalski' } })
    })
  })

  it('updates a record with an invalid version number', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|U|existingRecord|x|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 'x', '{"name":"Kowalski"}']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|INVALID_VERSION|existingRecord|NaN+'))
  })

  it('handles unsubscribe messages', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|US|someRecord'),
      topic: 'R',
      action: 'US',
      data: ['someRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|A|US|someRecord+'))

    recordHandler.handle(clientB, {
      raw: msg('R|US|someRecord'),
      topic: 'R',
      action: 'U',
      data: ['someRecord', 1, '{"bla":"blub"}']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|A|US|someRecord+'))
  })

  it('rejects updates for existing versions', () => {
    clientA.user = 'someUser'
    recordHandler.handle(clientA, {
      raw: msg('R|U|existingRecord|5|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 5, '{"name":"Kowalski"}']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|existingRecord|5|{"name":"Kowalski"}+'))
    expect(options.logger.lastLogMessage).toBe(msg('someUser tried to update record existingRecord to version 5 but it already was 5'))
  })

  it('handles invalid update messages', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|U|existingRecord|6'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 6]
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|existingRecord+'))
  })

  it('handles invalid patch messages', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|P|existingRecord|6|bla'),
      topic: 'R',
      action: 'P',
      data: ['existingRecord', 6, 'bla']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|R|P|existingRecord|6|bla+'))
  })

  it('updates a record via same client to the same version', (done) => {
    options.cacheRetrievalTimeout = 50
    options.cache.nextGetWillBeSynchronous = false
    clientA.socket.lastSendMessage = null
    clientB.socket.lastSendMessage = null
    recordHandler.handle(clientA, {
      raw: msg('R|U|existingRecord|6|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 6, '{"name":"Kowalski"}']
    })

    recordHandler.handle(clientA, {
      raw: msg('R|U|existingRecord|6|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 6, '{"name":"Kowalski"}']
    })

    setTimeout(() => {
      expect(clientB.socket.lastSendMessage).toBe(msg('R|U|existingRecord|6|{"name":"Kowalski"}+'))

			/**
			* Important to note this is a race condition since version exists errors are sent as soon as record is retrieved,
			* which means it hasn't yet been written to cache.
			*/
      expect(clientA.socket.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|existingRecord|5|{"name":"Kowalski"}+'))
      done()
    }, 50)
  })

  it('updates a record via different clients to the same version', (done) => {
    options.cacheRetrievalTimeout = 50
    options.cache.nextGetWillBeSynchronous = false
    clientA.socket.lastSendMessage = null
    clientB.socket.lastSendMessage = null

    recordHandler.handle(clientA, {
      raw: msg('R|U|existingRecord|7|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 7, '{"name":"Kowalski"}']
    })

    recordHandler.handle(clientB, {
      raw: msg('R|U|existingRecord|7|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 7, '{"name":"Kowalski"}']
    })

    setTimeout(() => {
      expect(clientA.socket.lastSendMessage).toBeNull()
			/**
			* Important to note this is a race condition since version exists flushes happen before the new record is
			* written to cache.
			*/
      expect(clientB.socket.getMsg(1)).toBe(msg('R|E|VERSION_EXISTS|existingRecord|6|{"name":"Kowalski"}+'))
      expect(clientB.socket.lastSendMessage).toBe(msg('R|U|existingRecord|7|{"name":"Kowalski"}+'))
      done()
    }, 50)
  })

  it('handles deletion messages', () => {
    options.cache.nextGetWillBeSynchronous = false
    recordHandler.handle(clientB, {
      raw: msg('R|U|existingRecord|8|{"name":"Kowalski"}'),
      topic: 'R',
      action: 'U',
      data: ['existingRecord', 8, '{"name":"Kowalski"}']
    })

    recordHandler.handle(clientA, {
      raw: msg('R|D|existingRecord'),
      topic: 'R',
      action: 'D',
      data: ['existingRecord']
    })


    expect(clientA.socket.lastSendMessage).toBe(msg('R|A|D|existingRecord+'))
    expect(clientB.socket.lastSendMessage).toBe(msg('R|A|D|existingRecord+'))

    options.cache.get('existingRecord', (error, record) => {
      expect(record).toEqual(undefined)
    })
  })

  it('creates another record', () => {
    options.cache.nextGetWillBeSynchronous = true
    recordHandler.handle(clientA, {
      topic: 'R',
      action: 'CR',
      data: ['anotherRecord']
    })

    expect(options.cache.lastSetKey).toBe('anotherRecord')
    expect(options.cache.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(options.storage.lastSetKey).toBe('anotherRecord')
    expect(options.storage.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|anotherRecord|0|{}+'))
  })

  it('receives a deletion message from the message connector for anotherRecord', () => {
    recordHandler.handle('SOURCE_MESSAGE_CONNECTOR', {
      raw: msg('R|D|anotherRecord'),
      topic: 'R',
      action: 'D',
      data: ['anotherRecord']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|D|anotherRecord+'))
  })

  it('creates another record', () => {
    options.cache.nextGetWillBeSynchronous = true
    recordHandler.handle(clientA, {
      topic: 'R',
      action: 'CR',
      data: ['overrideRecord']
    })

    expect(options.cache.lastSetKey).toBe('overrideRecord')
    expect(options.cache.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(options.storage.lastSetKey).toBe('overrideRecord')
    expect(options.storage.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|overrideRecord|0|{}+'))
  })


  it('updates a record with an -1 version number', () => {
    options.cache.nextGetWillBeSynchronous = true
    clientA.socket.lastSendMessage = null
    clientB.socket.lastSendMessage = null

    recordHandler.handle(clientB, {
      raw: msg('R|U|overrideRecord|-1|{"name":"Johansson"}'),
      topic: 'R',
      action: 'U',
      data: ['overrideRecord', -1, '{"name":"Johansson"}']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|U|overrideRecord|1|{"name":"Johansson"}+'))
    options.cache.get('overrideRecord', (error, record) => {
      expect(record).toEqual({ _v: 1, _d: { name: 'Johansson' } })
    })
  })

  it('updates a record again with an -1 version number', () => {

    recordHandler.handle(clientB, {
      raw: msg('R|U|overrideRecord|-1|{"name":"Tom"}'),
      topic: 'R',
      action: 'U',
      data: ['overrideRecord', -1, '{"name":"Tom"}']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|U|overrideRecord|2|{"name":"Tom"}+'))
    options.cache.get('overrideRecord', (error, record) => {
      expect(record).toEqual({ _v: 2, _d: { name: 'Tom' } })
    })
  })

  it('creates records when using CREATEANDUPDATE', () => {
    options.cache.nextGetWillBeSynchronous = true
    clientA.socket.lastSendMessage = null
    clientB.socket.lastSendMessage = null

    recordHandler.handle(clientB, {
      raw: msg('R|CU|upsertedRecord|-1|{"name":"Tom"}'),
      topic: 'R',
      action: 'CU',
      data: ['upsertedRecord', -1, '{"name":"Tom"}', '{}']
    })

    options.cache.get('upsertedRecord', (error, record) => {
      expect(record).toEqual({ _v: 1, _d: { name: 'Tom' } })
    })
  })
})

describe('record handler handles messages', () => {
  let recordHandler,
    clientA = new SocketWrapper(new SocketMock(), {}),
    clientB = new SocketWrapper(new SocketMock(), {}),
    options = {
      clusterRegistry: clusterRegistryMock,
      cache: new StorageMock(),
      storage: new StorageMock(),
      storageExclusion: new RegExp('no-storage'),
      logger: new LoggerMock(),
      messageConnector: noopMessageConnector,
      permissionHandler: { canPerformAction(a, b, c) { c(null, true) } },
      uniqueRegistry: {
        get() {},
        release() {}
      }
    }

  options.cache.nextGetWillBeSynchronous = true

  it('creates the record handler', () => {
    recordHandler = new RecordHandler(options)
    expect(recordHandler.handle).toBeDefined()
  })

  it('creates record test', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|CR|test'),
      topic: 'R',
      action: 'CR',
      data: ['test']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|test|0|{}+'))
  })

  it('deletes record test', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|D|test'),
      topic: 'R',
      action: 'D',
      data: ['test']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|A|D|test+'))
  })


  it('creates record test', () => {
    clientA.socket.sendMessages = []
    recordHandler.handle(clientA, {
      raw: msg('R|CR|test'),
      topic: 'R',
      action: 'CR',
      data: ['test']
    })

    expect(clientA.socket.sendMessages[0]).not.toContain('MULTIPLE_SUBSCRIPTIONS')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|test|0|{}+'))
  })

  it('creates record deleteEvent', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|CR|deleteEvent'),
      topic: 'R',
      action: 'CR',
      data: ['deleteEvent']
    })

    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|deleteEvent|0|{}+'))
  })

  it('subscribes record deleteEvent', () => {
    recordHandler.handle(clientB, {
      raw: msg('R|CR|deleteEvent'),
      topic: 'R',
      action: 'CR',
      data: ['deleteEvent']
    })

    expect(clientB.socket.lastSendMessage).toBe(msg('R|R|deleteEvent|0|{}+'))
  })

  it('deletes record deleteEvent and receives event', () => {
    recordHandler.handle(clientA, {
      raw: msg('R|D|deleteEvent'),
      topic: 'R',
      action: 'D',
      data: ['deleteEvent']
    })

    expect(clientB.socket.lastSendMessage).toBe(msg('R|A|D|deleteEvent+'))
  })
})
