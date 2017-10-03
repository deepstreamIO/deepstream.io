/* eslint-disable max-len, import/no-extraneous-dependencies */
/* global jasmine, xit, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RecordHandler = require('../../dist/src/record/record-handler').default

const M = require('./messages')
const C = require('../../dist/src/constants')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

describe('record handler handles messages', () => {
  let testMocks
  let recordHandler
  let client
  let options

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper('someUser')
    options = testHelper.getDeepstreamOptions()
    recordHandler = new RecordHandler(
      options.config, options.services, testMocks.subscriptionRegistry, testMocks.listenerRegistry
    )
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
    testMocks.subscriptionRegistryMock.verify()
  })

  it('creates a non existing record', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.readMessage)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect(options.services.cache.lastSetKey).toBe('some-record')
    expect(options.services.cache.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(options.services.storage.lastSetKey).toBe('some-record')
    expect(options.services.storage.lastSetValue).toEqual({ _v: 0, _d: { } })
  })

  it('tries to create a non existing record, but receives an error from the cache', () => {
    options.services.cache.failNextSet = true

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.createOrReadMessage, C.EVENT.RECORD_CREATE_ERROR)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)
    // expect(options.logger.lastLogMessage).toBe('storage:storageError')
  })

  it('does not store new record when excluded', () => {
    options.config.storageExclusion = new RegExp('some-record')

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect(options.services.storage.lastSetKey).toBe(null)
    expect(options.services.storage.lastSetValue).toBe(null)
  })

  it('returns an existing record', () => {
    options.services.cache.set('some-record', M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.READ,
        name: 'some-record',
        version: M.recordData._v,
        parsedData: M.recordData._d
      })

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)
  })

  it('returns true for HAS if message exists', () => {
    options.services.cache.set('some-record', {}, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.HAS,
        name: 'some-record',
        parsedData: true
      })

    recordHandler.handle(client.socketWrapper, M.recordHasMessage)
  })

  it('returns false for HAS if message doesn\'t exists', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.HAS,
        name: 'some-record',
        parsedData: false
      })

    recordHandler.handle(client.socketWrapper, M.recordHasMessage)
  })

  it('returns an error for HAS if message error occurs with record retrieval', () => {
    options.services.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.recordHasMessage, C.EVENT.RECORD_LOAD_ERROR)

    recordHandler.handle(client.socketWrapper, M.recordHasMessage)
  })

  it('returns a snapshot of the data that exists with version number and data', () => {
    options.services.cache.set('some-record', M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.READ,
        name: 'some-record',
        parsedData: M.recordData._d,
        version: M.recordData._v
      })

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns an error for a snapshot of data that doesn\'t exists', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.recordSnapshotMessage, C.EVENT.RECORD_NOT_FOUND)

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns an error for a snapshot if message error occurs with record retrieval', () => {
    options.services.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.recordSnapshotMessage, C.EVENT.RECORD_LOAD_ERROR)

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns a version of the data that exists with version number', () => {
    ['record/1', 'record/2', 'record/3'].forEach((name) => {
      const recordData = { _v: Math.random(), _d: { firstname: 'Wolfram' } }
      options.services.cache.set(name, recordData, () => {})

      client.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({}, M.recordHeadMessage, { name, version: recordData._v }))

      recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordHeadMessage, { name }))
    })
  })

  it('returns an error for a head request of data that doesn\'t exists', () => {
    ['record/1', 'record/2', 'record/3'].forEach((name) => {
      client.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs(Object.assign({}, M.recordHeadMessage, { name }), C.EVENT.RECORD_NOT_FOUND)

      recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordHeadMessage, { name }))
    })
  })

  it('returns an error for a version if message error occurs with record retrieval', () => {
    options.services.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.recordHeadMessage, C.EVENT.RECORD_LOAD_ERROR)

    recordHandler.handle(client.socketWrapper, M.recordHeadMessage)
  })

  xit('patches a record', () => {
    options.services.cache.set('some-record', recordData, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(recordPatch)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)
    recordHandler.handle(client.socketWrapper, M.recordPatch)

    options.services.cache.get('some-record', (error, record) => {
      expect(record).toEqual({ _v: 6, _d: { name: 'Kowalski', lastname: 'Egon' } })
    })
  })

  fit('updates a record', () => {
    options.services.cache.set('some-record', M.recordData, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordUpdate.name, M.recordUpdate, false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, M.recordUpdate)

    options.services.cache.get('some-record', (error, record) => {
      expect(record).toEqual({ _v: 6, _d: { name: 'Kowalski' } })
    })
  })

  xit('rejects updates for existing versions', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.recordUpdate, C.EVENT.VERSION_EXISTS)

    recordHandler.handle(client.socketWrapper, M.recordUpdate)

    expect(options.logger.lastLogMessage).toBe('someUser tried to update record existingRecord to version 5 but it already was 5')
  })

  describe('subscription registry', () => {
    it('handles unsubscribe messages', () => {
      testMocks.subscriptionRegistryMock
        .expects('unsubscribe')
        .once()
        .withExactArgs(M.unsubscribeMessage, client.socketWrapper)

      recordHandler.handle(client.socketWrapper, M.unsubscribeMessage)
    })
  })

  xit('updates a record via same client to the same version', (done) => {
    options.cacheRetrievalTimeout = 50
    options.services.cache.nextGetWillBeSynchronous = false
    options.services.cache.set(recordUpdate.name, recordData, () => {})

    client.socketWrapperMock
      .expects('sendError')
      .twice()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        version: recordData._v,
        parsedData: recordData._d,
        name: recordUpdate.name,
        isWriteAck: false
      }, C.EVENT.VERSION_EXISTS)

    recordHandler.handle(client.socketWrapper, M.recordUpdate)
    recordHandler.handle(client.socketWrapper, M.recordUpdate)

    setTimeout(() => {
      /**
      * Important to note this is a race condition since version exists errors are sent as soon as record is retrieved,
      * which means it hasn't yet been written to cache.
      */
      done()
    }, 50)
  })

  it('handles deletion messages', () => {
    options.services.cache.nextGetWillBeSynchronous = false
    options.services.cache.set(M.recordDelete.name, {}, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordDelete.name, {
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.DELETE,
        isAck: true,
        name: M.recordDelete.name
      }, true, client.socketWrapper)

    testMocks.subscriptionRegistryMock
      .expects('getLocalSubscribers')
      .once()
      .returns(new Set())

    recordHandler.handle(client.socketWrapper, M.recordDelete)

    options.services.cache.get(M.recordDelete.name, (error, record) => {
      expect(record).toEqual(undefined)
    })
  })

  xit('updates a record with a -1 version number', () => {
    const data = Object.assign({}, recordData)
    options.services.cache.set(M.recordUpdate.name, data, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(data.name, Object.assign({}, data, { _v: 6 }), false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, Object.assign({}, data, { version: -1 }))

    options.services.cache.get(M.recordUpdate.name, (error, record) => {
      record._v = 6
      expect(record).toEqual(data)
    })
  })

  xit('updates multiple updates with an -1 version number', () => {
    const data = Object.assign({}, recordData)
    options.services.cache.set(data.name, data, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(data.name, Object.assign({}, data, { _v: 6 }), false, client.socketWrapper)

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(data.name, Object.assign({}, data, { _v: 7 }), false, client.socketWrapper)


    recordHandler.handle(client.socketWrapper, Object.assign({}, data, { version: -1 }))
    recordHandler.handle(client.socketWrapper, Object.assign({}, data, { version: -1 }))

    options.services.cache.get(data.name, (error, record) => {
      record._v = 7
      expect(record).toEqual(data)
    })
  })

  it('creates records when using CREATEANDUPDATE', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(
        M.createAndUpdate.name,
        Object.assign({}, M.createAndUpdate, { action: C.ACTIONS.UPDATE, version: 1 }),
        false,
        client.socketWrapper
      )

    recordHandler.handle(client.socketWrapper, M.createAndUpdate)

    options.services.cache.get(M.createAndUpdate.name, (error, record) => {
      expect(record).toEqual(Object.assign({}, M.recordData, { _v: 1 }))
    })
  })

  it('registers a listener', () => {
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, M.listenMessage)

    recordHandler.handle(client.socketWrapper, M.listenMessage)
  })

  it('removes listeners', () => {
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, M.unlistenMessage)

    recordHandler.handle(client.socketWrapper, M.unlistenMessage)
  })

  it('processes listen accepts', () => {
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, M.listenAcceptMessage)

    recordHandler.handle(client.socketWrapper, M.listenAcceptMessage)
  })

  it('processes listen rejects', () => {
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, M.listenRejectMessage)

    recordHandler.handle(client.socketWrapper, M.listenRejectMessage)
  })
})
