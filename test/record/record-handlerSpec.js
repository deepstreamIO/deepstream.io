/* eslint-disable max-len, import/no-extraneous-dependencies */
/* global jasmine, xit, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RecordHandler = require('../../dist/src/record/record-handler')

const C = require('../../dist/src/constants/constants')
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
      options, testMocks.subscriptionRegistry, testMocks.listenerRegistry
    )
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
    testMocks.subscriptionRegistryMock.verify()
  })

  const subscribeMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.SUBSCRIBE,
    name: 'some-record'
  }
  Object.freeze(subscribeMessage)

  const unsubscribeMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.UNSUBSCRIBE,
    name: 'some-record'
  }
  Object.freeze(unsubscribeMessage)

  const createOrReadMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATEORREAD,
    name: 'some-record'
  }
  Object.freeze(createOrReadMessage)

  const readMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.READ,
    name: 'some-record',
    version: 0,
    parsedData: {}
  }
  Object.freeze(readMessage)

  const recordHasMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.HAS,
    name: 'some-record'
  }
  Object.freeze(recordHasMessage)

  const recordSnapshotMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.SNAPSHOT,
    name: 'some-record'
  }
  Object.freeze(recordSnapshotMessage)

  const recordHeadMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.HEAD,
    name: 'some-record'
  }
  Object.freeze(recordHeadMessage)

  const recordData = { _v: 5, _d: { name: 'Kowalski' } }
  Object.freeze(recordData)

  const recordUpdate = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.UPDATE,
    name: 'some-record',
    version: recordData._v + 1,
    parsedData: recordData._d,
    isWriteAck: false
  }
  Object.freeze(recordUpdate)

  const recordPatch = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.PATCH,
    name: 'some-record',
    version: recordData._v + 1,
    path: 'lastname',
    data: 'SEgon',
    isWriteAck: false
  }
  Object.freeze(recordPatch)

  const recordDelete = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.DELETE,
    name: 'some-record'
  }
  Object.freeze(recordDelete)

  const createAndUpdate = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATEANDUPDATE,
    name:'some-record',
    version:  -1,
    parsedData: recordData._d,
    path: null,
    isWriteAck: false
  }
  Object.freeze(createAndUpdate)

  it('creates a non existing record', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(readMessage)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)

    expect(options.cache.lastSetKey).toBe('some-record')
    expect(options.cache.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(options.storage.lastSetKey).toBe('some-record')
    expect(options.storage.lastSetValue).toEqual({ _v: 0, _d: { } })
  })

  it('tries to create a non existing record, but receives an error from the cache', () => {
    options.cache.failNextSet = true

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(createOrReadMessage, C.EVENT.RECORD_CREATE_ERROR)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)
    // expect(options.logger.lastLogMessage).toBe('storage:storageError')
  })

  it('does not store new record when excluded', () => {
    options.storageExclusion = new RegExp('some-record')

    recordHandler.handle(client.socketWrapper, createOrReadMessage)

    expect(options.storage.lastSetKey).toBe(null)
    expect(options.storage.lastSetValue).toBe(null)
  })

  it('returns an existing record', () => {
    const parsedData = { _v: 3, _d: { firstname: 'Wolfram' } }
    options.cache.set('some-record', parsedData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.READ,
        name: 'some-record',
        version: 3,
        parsedData: parsedData._d
      })

    recordHandler.handle(client.socketWrapper, createOrReadMessage)
  })

  it('returns true for HAS if message exists', () => {
    options.cache.set('some-record', {}, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.HAS,
        name: 'some-record',
        parsedData: true
      })

    recordHandler.handle(client.socketWrapper, recordHasMessage)
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

    recordHandler.handle(client.socketWrapper, recordHasMessage)
  })

  it('returns an error for HAS if message error occurs with record retrieval', () => {
    options.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(recordHasMessage, C.EVENT.RECORD_LOAD_ERROR)

    recordHandler.handle(client.socketWrapper, recordHasMessage)
  })

  it('returns a snapshot of the data that exists with version number and data', () => {
    const parsedData = { _v: 3, _d: { firstname: 'Wolfram' } }
    options.cache.set('some-record', parsedData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.READ,
        name: 'some-record',
        parsedData: parsedData._d,
        version: 3
      })

    recordHandler.handle(client.socketWrapper, recordSnapshotMessage)
  })

  it('returns an error for a snapshot of data that doesn\'t exists', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(recordSnapshotMessage, C.EVENT.RECORD_NOT_FOUND)

    recordHandler.handle(client.socketWrapper, recordSnapshotMessage)
  })

  it('returns an error for a snapshot if message error occurs with record retrieval', () => {
    options.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(recordSnapshotMessage, C.EVENT.RECORD_LOAD_ERROR)

    recordHandler.handle(client.socketWrapper, recordSnapshotMessage)
  })

  it('returns a version of the data that exists with version number', () => {
    ['record/1', 'record/2', 'record/3'].forEach((name) => {
      const parsedData = { _v: Math.random(), _d: { firstname: 'Wolfram' } }
      options.cache.set(name, parsedData, () => {})

      client.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({}, recordHeadMessage, { name, version: parsedData._v }))

      recordHandler.handle(client.socketWrapper, Object.assign({}, recordHeadMessage, { name }))
    })
  })

  it('returns an error for a head request of data that doesn\'t exists', () => {
    ['record/1', 'record/2', 'record/3'].forEach((name) => {
      client.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs(Object.assign({}, recordHeadMessage, { name }), C.EVENT.RECORD_NOT_FOUND)

      recordHandler.handle(client.socketWrapper, Object.assign({}, recordHeadMessage, { name }))
    })
  })

  it('returns an error for a version if message error occurs with record retrieval', () => {
    options.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(recordHeadMessage, C.EVENT.RECORD_LOAD_ERROR)

    recordHandler.handle(client.socketWrapper, recordHeadMessage)
  })

  xit('patches a record', () => {
    options.cache.set('some-record', recordData, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(recordPatch)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)
    recordHandler.handle(client.socketWrapper, recordPatch)

    options.cache.get('some-record', (error, record) => {
      expect(record).toEqual({ _v: 6, _d: { name: 'Kowalski', lastname: 'Egon' } })
    })
  })

  it('updates a record', () => {
    options.cache.set('some-record', recordData, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(recordUpdate.name, recordUpdate, false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, recordUpdate)

    options.cache.get('some-record', (error, record) => {
      expect(record).toEqual({ _v: 6, _d: { name: 'Kowalski' } })
    })
  })

  xit('rejects updates for existing versions', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(recordUpdate, C.EVENT.VERSION_EXISTS)

    recordHandler.handle(client.socketWrapper, recordUpdate)

    expect(options.logger.lastLogMessage).toBe('someUser tried to update record existingRecord to version 5 but it already was 5')
  })

  describe('subscription registry', () => {
    it('handles unsubscribe messages', () => {
      testMocks.subscriptionRegistryMock
        .expects('unsubscribe')
        .once()
        .withExactArgs(unsubscribeMessage, client.socketWrapper)

      recordHandler.handle(client.socketWrapper, unsubscribeMessage)
    })
  })

  xit('updates a record via same client to the same version', (done) => {
    options.cacheRetrievalTimeout = 50
    options.cache.nextGetWillBeSynchronous = false
    options.cache.set(recordUpdate.name, recordData, () => {})

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

    recordHandler.handle(client.socketWrapper, recordUpdate)
    recordHandler.handle(client.socketWrapper, recordUpdate)

    setTimeout(() => {
      /**
      * Important to note this is a race condition since version exists errors are sent as soon as record is retrieved,
      * which means it hasn't yet been written to cache.
      */
      done()
    }, 50)
  })

  it('handles deletion messages', () => {
    options.cache.nextGetWillBeSynchronous = false
    options.cache.set(recordDelete.name, {}, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(recordDelete.name, {
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.DELETE,
        isAck: true,
        name: recordDelete.name
      }, true, client.socketWrapper)

    testMocks.subscriptionRegistryMock
      .expects('getLocalSubscribers')
      .once()
      .returns(new Set())

    recordHandler.handle(client.socketWrapper, recordDelete)

    options.cache.get(recordDelete.name, (error, record) => {
      expect(record).toEqual(undefined)
    })
  })

  xit('updates a record with a -1 version number', () => {
    const data = Object.assign({}, recordData)
    options.cache.set(recordUpdate.name, data, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(data.name, Object.assign({}, data, { _v: 6 }), false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, Object.assign({}, data, { version: -1 }))

    options.cache.get(recordUpdate.name, (error, record) => {
      record._v = 6
      expect(record).toEqual(data)
    })
  })

  xit('updates multiple updates with an -1 version number', () => {
    const data = Object.assign({}, recordData)
    options.cache.set(data.name, data, () => {})

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

    options.cache.get(data.name, (error, record) => {
      record._v = 7
      expect(record).toEqual(data)
    })
  })

  it('creates records when using CREATEANDUPDATE', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(
        createAndUpdate.name,
        Object.assign({}, createAndUpdate, { action: C.ACTIONS.UPDATE, version: 1 }),
        false,
        client.socketWrapper
      )

    recordHandler.handle(client.socketWrapper, createAndUpdate)

    options.cache.get(createAndUpdate.name, (error, record) => {
      expect(record).toEqual(Object.assign({}, recordData, { _v: 1 }))
    })
  })

  it('registers a listener', () => {
    const listenMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.LISTEN,
      name: 'record/.*'
    }
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, listenMessage)

    recordHandler.handle(client.socketWrapper, listenMessage)
  })

  it('removes listeners', () => {
    const unlistenMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UNLISTEN,
      name: 'record/.*'
    }
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, unlistenMessage)

    recordHandler.handle(client.socketWrapper, unlistenMessage)
  })

  it('processes listen accepts', () => {
    const listenAcceptMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.LISTEN_ACCEPT,
      name: 'record/.*',
      subscription: 'record/A'
    }
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, listenAcceptMessage)

    recordHandler.handle(client.socketWrapper, listenAcceptMessage)
  })

  it('processes listen rejects', () => {
    const listenRejectMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.LISTEN_REJECT,
      name: 'record/.*',
      subscription: 'record/A'
    }
    testMocks.listenerRegistryMock
      .expects('handle')
      .once()
      .withExactArgs(client.socketWrapper, listenRejectMessage)

    recordHandler.handle(client.socketWrapper, listenRejectMessage)
  })
})
