import * as C from '../../src/constants'
require('source-map-support').install()

const RecordHandler = require('../../src/record/record-handler').default

const M = require('./messages')

const testHelper = require('../test-helper/test-helper')
import { getTestMocks } from '../test-helper/test-mocks'

describe('record handler handles messages', () => {
  let testMocks
  let recordHandler
  let client
  let config
  let services

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper('someUser')
    const options = testHelper.getDeepstreamOptions()
    config = options.config
    services = options.services
    recordHandler = new RecordHandler(
      config, services, testMocks.subscriptionRegistry, testMocks.listenerRegistry
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
      .withExactArgs(M.readResponseMessage)

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.cache.lastSetKey).toBe('some-record')
    expect(services.cache.lastSetValue).toEqual({ _v: 0, _d: { } })

    expect(services.storage.lastSetKey).toBe('some-record')
    expect(services.storage.lastSetValue).toEqual({ _v: 0, _d: { } })
  })

  it('tries to create a non existing record, but receives an error from the cache', () => {
    services.cache.failNextSet = true

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.RECORD_CREATE_ERROR,
        originalAction: C.RECORD_ACTIONS.SUBSCRIBECREATEANDREAD,
        name: M.subscribeCreateAndReadMessage.name
      })

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)
    // expect(options.logger.lastLogMessage).toBe('storage:storageError')
  })

  it('does not store new record when excluded', () => {
    config.storageExclusion = new RegExp('some-record')

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.storage.lastSetKey).toBe(null)
    expect(services.storage.lastSetValue).toBe(null)
  })

  it('returns an existing record', () => {
    services.cache.set('some-record', M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.READ_RESPONSE,
        name: 'some-record',
        version: M.recordData._v,
        parsedData: M.recordData._d
      })

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)
  })

  it('returns a snapshot of the data that exists with version number and data', () => {
    services.cache.set('some-record', M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.READ_RESPONSE,
        name: 'some-record',
        parsedData: M.recordData._d,
        version: M.recordData._v
      })

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns an error for a snapshot of data that doesn\'t exists', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.RECORD_NOT_FOUND,
        originalAction: M.recordSnapshotMessage.action,
        name: M.recordSnapshotMessage.name,
      })

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns an error for a snapshot if message error occurs with record retrieval', () => {
    services.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.RECORD_LOAD_ERROR,
        originalAction: M.recordSnapshotMessage.action,
        name: M.recordSnapshotMessage.name,
      })

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns a version of the data that exists with version number', () => {
    ['record/1', 'record/2', 'record/3'].forEach(name => {
      const recordData = { _v: Math.random(), _d: { firstname: 'Wolfram' } }
      services.cache.set(name, recordData, () => {})

      client.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({}, M.recordHeadResponseMessage, { name, version: recordData._v }))

      recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordHeadMessage, { name }))
    })
  })

  it('returns an version of -1 for head request of data that doesn\'t exist', () => {
    ['record/1', 'record/2', 'record/3'].forEach(name => {
      client.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({}, {
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTIONS.HEAD_RESPONSE,
          name: M.recordHeadMessage.name,
          version: -1
        }, { name }))

      recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordHeadMessage, { name }))
    })
  })

  it('returns an error for a version if message error occurs with record retrieval', () => {
    services.cache.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.RECORD_LOAD_ERROR,
        originalAction: M.recordHeadMessage.action,
        name: M.recordHeadMessage.name,
      })

    recordHandler.handle(client.socketWrapper, M.recordHeadMessage)
  })

  xit('patches a record', () => {
    const recordPatch = Object.assign({}, M.recordPatch)
    services.cache.set('some-record', Object.assign({}, M.recordData), () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordPatch.name, recordPatch, false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, recordPatch)

    services.cache.get('some-record', (error, record) => {
      expect(record).toEqual({ _v: 6, _d: { name: 'Kowalski', lastname: 'Egon' } })
    })
  })

  it('updates a record', () => {
    services.cache.set('some-record', M.recordData, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordUpdate.name, M.recordUpdate, false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, M.recordUpdate)

    services.cache.get('some-record', (error, record) => {
      expect(record).toEqual({ _v: 6, _d: { name: 'Kowalski' } })
    })
  })

  it('rejects updates for existing versions', () => {
    services.cache.set(M.recordUpdate.name, M.recordData, () => {})
    const ExistingVersion = Object.assign({}, M.recordUpdate, { version: M.recordData._v })

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.VERSION_EXISTS,
        originalAction: ExistingVersion.action,
        name: ExistingVersion.name,
        version: ExistingVersion.version,
        parsedData: M.recordData._d,
        isWriteAck: false
      })

    recordHandler.handle(client.socketWrapper, ExistingVersion)

    expect(services.logger.lastLogMessage).toBe('someUser tried to update record some-record to version 5 but it already was 5')
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

  it('updates a record via same client to the same version', done => {
    config.cacheRetrievalTimeout = 50
    services.cache.nextGetWillBeSynchronous = false
    services.cache.set(M.recordUpdate.name, M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .twice()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.VERSION_EXISTS,
        originalAction: C.RECORD_ACTIONS.UPDATE,
        version: M.recordData._v,
        parsedData: M.recordData._d,
        name: M.recordUpdate.name,
        isWriteAck: false
      })

    recordHandler.handle(client.socketWrapper, M.recordUpdate)
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
    services.cache.nextGetWillBeSynchronous = false
    services.cache.set(M.recordDelete.name, {}, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordDelete.name, {
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.DELETED,
        name: M.recordDelete.name
      }, true, client.socketWrapper)

    testMocks.subscriptionRegistryMock
      .expects('getLocalSubscribers')
      .once()
      .returns(new Set())

    recordHandler.handle(client.socketWrapper, M.recordDelete)

    services.cache.get(M.recordDelete.name, (error, record) => {
      expect(record).toEqual(null)
    })
  })

  it('updates a record with a -1 version number', () => {
    const data = Object.assign({}, M.recordData)
    services.cache.set(M.recordUpdate.name, data, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordUpdate.name, Object.assign({}, M.recordUpdate, { version: 6 }), false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: -1 }))

    services.cache.get(M.recordUpdate.name, (error, record) => {
      data._v = 6
      expect(record).toEqual(data)
    })
  })

  it('updates multiple updates with an -1 version number', () => {
    const data = Object.assign({}, M.recordData)
    services.cache.set(M.recordUpdate.name, data, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordUpdate.name, Object.assign({}, M.recordUpdate, { version: 6 }), false, client.socketWrapper)

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordUpdate.name, Object.assign({}, M.recordUpdate, { version: 7 }), false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: -1 }))
    recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: -1 }))

    services.cache.get(M.recordUpdate.name, (error, record) => {
      data._v = 7
      expect(record).toEqual(data)
    })
  })

  it('creates records when using CREATEANDUPDATE', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(
        M.createAndUpdate.name,
        Object.assign({}, M.createAndUpdate, { action: C.RECORD_ACTIONS.UPDATE, version: 1 }),
        false,
        client.socketWrapper
      )

    recordHandler.handle(client.socketWrapper, M.createAndUpdate)

    services.cache.get(M.createAndUpdate.name, (error, record) => {
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
