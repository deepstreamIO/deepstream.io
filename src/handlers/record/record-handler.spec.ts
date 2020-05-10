import 'mocha'

import * as C from '../../../src/constants'
import { expect } from 'chai'

import RecordHandler from './record-handler'

import * as M from './test-messages'

import * as testHelper from '../../test/helper/test-helper'
import { getTestMocks } from '../../test/helper/test-mocks'

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

    expect(services.cache.lastSetKey).to.equal('some-record')
    expect(services.cache.lastSetVersion).to.equal(0)
    expect(services.cache.lastSetValue).to.deep.equal({})

    expect(services.storage.lastSetKey).to.equal('some-record')
    expect(services.storage.lastSetVersion).to.equal(0)
    expect(services.storage.lastSetValue).to.deep.equal({})
  })

  it('tries to create a non existing record, but receives an error from the cache', () => {
    services.cache.failNextSet = true

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.RECORD_CREATE_ERROR,
        originalAction: C.RECORD_ACTION.SUBSCRIBECREATEANDREAD,
        name: M.subscribeCreateAndReadMessage.names[0]
      })

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)
    // expect(options.logger.lastLogMessage).to.equal('storage:storageError')
  })

  it('does not store new record when excluded', () => {
    config.record.storageExclusionPrefixes = ['some-record']

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.storage.lastSetKey).to.equal(null)
    expect(services.storage.lastSetVersion).to.equal(null)
    expect(services.storage.lastSetValue).to.equal(null)
  })

  it('returns an existing record', () => {
    services.cache.set('some-record', M.recordVersion, M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.READ_RESPONSE,
        name: 'some-record',
        version: M.recordVersion,
        parsedData: M.recordData
      })

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)
  })

  it('returns a snapshot of the data that exists with version number and data', () => {
    services.cache.set('some-record', M.recordVersion, M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.READ_RESPONSE,
        name: 'some-record',
        parsedData: M.recordData,
        version: M.recordVersion
      })

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns an error for a snapshot of data that doesn\'t exists', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.RECORD_NOT_FOUND,
        originalAction: M.recordSnapshotMessage.action,
        name: M.recordSnapshotMessage.name,
        isError: true
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
        action: C.RECORD_ACTION.RECORD_LOAD_ERROR,
        originalAction: M.recordSnapshotMessage.action,
        name: M.recordSnapshotMessage.name,
        isError: true
      })

    recordHandler.handle(client.socketWrapper, M.recordSnapshotMessage)
  })

  it('returns a version of the data that exists with version number', () => {
    ['record/1', 'record/2', 'record/3'].forEach((name) => {
      const version = Math.floor(Math.random() * 100)
      const data = { firstname: 'Wolfram' }
      services.cache.set(name, version, data, () => {})

      client.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({}, M.recordHeadResponseMessage, { name, version }))

      recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordHeadMessage, { name }))
    })
  })

  it('returns an version of -1 for head request of data that doesn\'t exist', () => {
    ['record/1', 'record/2', 'record/3'].forEach((name) => {
      client.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({}, {
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTION.HEAD_RESPONSE,
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
        action: C.RECORD_ACTION.RECORD_LOAD_ERROR,
        originalAction: M.recordHeadMessage.action,
        name: M.recordHeadMessage.name,
        isError: true
      })

    recordHandler.handle(client.socketWrapper, M.recordHeadMessage)
  })

  it('patches a record', () => {
    const recordPatch = Object.assign({}, M.recordPatch)
    services.cache.set('some-record', M.recordVersion, Object.assign({}, M.recordData), () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordPatch.name, recordPatch, false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, recordPatch)

    services.cache.get('some-record', (error, version, record) => {
      expect(version).to.equal(version)
      expect(record).to.deep.equal({ name: 'Kowalski', lastname: 'Egon' })
    })
  })

  it('updates a record', () => {
    services.cache.set('some-record', M.recordVersion, M.recordData, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordUpdate.name, M.recordUpdate, false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, M.recordUpdate)

    services.cache.get('some-record', (error, version, result) => {
      expect(version).to.equal(6)
      expect(result).to.deep.equal({ name: 'Kowalski' })
    })
  })

  it('rejects updates for existing versions', () => {
    services.cache.set(M.recordUpdate.name, M.recordVersion, M.recordData, () => {})
    const ExistingVersion = Object.assign({}, M.recordUpdate, { version: M.recordVersion })

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.VERSION_EXISTS,
        originalAction: ExistingVersion.action,
        name: ExistingVersion.name,
        version: ExistingVersion.version,
        parsedData: M.recordData,
        isWriteAck: false,
        correlationId: undefined
      })

    recordHandler.handle(client.socketWrapper, ExistingVersion)

    expect(services.logger.lastLogMessage).to.equal('someUser tried to update record some-record to version 5 but it already was 5')
  })

  describe('notifies when db/cache remotely changed', () => {
    beforeEach(() => {
      services.storage.nextGetWillBeSynchronous = true
      services.cache.nextGetWillBeSynchronous = true
    })

    it ('notifies users when record changes', () => {
      M.notify.names.forEach(name => {
        services.storage.set(name, 123, { name }, () => {})

        testMocks.subscriptionRegistryMock
          .expects('sendToSubscribers')
          .once()
          .withExactArgs(name, {
            topic: C.TOPIC.RECORD,
            action: C.RECORD_ACTION.UPDATE,
            name,
            parsedData: { name },
            version: 123
          }, true, null)
      })

      recordHandler.handle(client.socketWrapper, M.notify)
    })

    it('notifies users when records deleted', () => {
      M.notify.names.forEach(name => {
        testMocks.subscriptionRegistryMock
          .expects('sendToSubscribers')
          .once()
          .withExactArgs(name, {
            topic: C.TOPIC.RECORD,
            action: C.RECORD_ACTION.DELETED,
            name
          }, true, null)
      })

      recordHandler.handle(client.socketWrapper, M.notify)
    })

    it('notifies users when records updated and deleted combined', () => {
      services.storage.set(M.notify.names[0], 1, { name: M.notify.names[0] }, () => {})

      testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.notify.names[0], {
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.UPDATE,
        name: M.notify.names[0],
        parsedData: { name: M.notify.names[0] },
        version: 1
      }, true, null)

      testMocks.subscriptionRegistryMock
        .expects('sendToSubscribers')
        .once()
        .withExactArgs(M.notify.names[1], {
          topic: C.TOPIC.RECORD,
          action: C.RECORD_ACTION.DELETED,
          name: M.notify.names[1]
        }, true, null)

      recordHandler.handle(client.socketWrapper, M.notify)
    })
  })

  describe('subscription registry', () => {
    it('handles unsubscribe messages', () => {
      testMocks.subscriptionRegistryMock
        .expects('unsubscribeBulk')
        .once()
        .withExactArgs(M.unsubscribeMessage, client.socketWrapper)

      recordHandler.handle(client.socketWrapper, M.unsubscribeMessage)
    })
  })

  it('updates a record via same client to the same version', (done) => {
    config.record.cacheRetrievalTimeout = 50
    services.cache.nextGetWillBeSynchronous = false
    services.cache.set(M.recordUpdate.name, M.recordVersion, M.recordData, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .twice()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.VERSION_EXISTS,
        originalAction: C.RECORD_ACTION.UPDATE,
        version: M.recordVersion,
        parsedData: M.recordData,
        name: M.recordUpdate.name,
        isWriteAck: false,
        correlationId: undefined
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
    services.cache.set(M.recordDelete.name, 1, {}, () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordDelete.name, {
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.DELETED,
        name: M.recordDelete.name
      }, true, client.socketWrapper)

    testMocks.subscriptionRegistryMock
      .expects('getLocalSubscribers')
      .once()
      .returns(new Set())

    recordHandler.handle(client.socketWrapper, M.recordDelete)

    services.cache.get(M.recordDelete.name, (error, version, data) => {
      expect(version).to.deep.equal(-1)
      expect(data).to.equal(null)
    })
  })

  it('updates a record with a -1 version number', () => {
    services.cache.set(M.recordUpdate.name, 5, Object.assign({}, M.recordData), () => {})

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(M.recordUpdate.name, Object.assign({}, M.recordUpdate, { version: 6 }), false, client.socketWrapper)

    recordHandler.handle(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: -1 }))

    services.cache.get(M.recordUpdate.name, (error, version, data) => {
      expect(data).to.deep.equal(M.recordUpdate.parsedData)
      expect(version).to.equal(6)
    })
  })

  it('updates multiple updates with an -1 version number', () => {
    const data = Object.assign({}, M.recordData)
    services.cache.set(M.recordUpdate.name, 5, data, () => {})

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

    services.cache.get(M.recordUpdate.name, (error, version, result) => {
      expect(result).to.deep.equal(M.recordUpdate.parsedData)
    })
  })

  it.skip('creates records when using CREATEANDUPDATE', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(
        M.createAndUpdate.name,
        Object.assign({}, M.createAndUpdate, { action: C.RECORD_ACTION.UPDATE, version: 1 }),
        false,
        client.socketWrapper
      )

    recordHandler.handle(client.socketWrapper, M.createAndUpdate)

    services.cache.get(M.createAndUpdate.name, (error, version, data) => {
      expect(version).to.deep.equal(1)
      expect(data).to.deep.equal(M.recordData)
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
