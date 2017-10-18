'use strict'

const RecordDeletion = require('../../src/record/record-deletion').default

const M = require('./messages')
const C = require('../../src/constants')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

describe('record deletion', () => {
  let testMocks
  let recordDeletion
  let client
  let config
  let services
  let callback

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()
    const options = testHelper.getDeepstreamOptions()
    config = options.config
    services = options.services
    callback = jasmine.createSpy('callback')
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('deletes records - happy path', () => {
    client.socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs(M.deletionMsg)

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.deletionMsg, callback
    )

    expect(services.cache.completedDeleteOperations).toBe(1)
    expect(services.storage.completedDeleteOperations).toBe(1)

    expect(recordDeletion.isDestroyed).toBe(true)
    expect(callback).toHaveBeenCalled()
  })

  it('encounters an error during record deletion', (done) => {
    services.cache.nextOperationWillBeSuccessful = false
    services.cache.nextOperationWillBeSynchronous = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.DELETE,
        name: 'someRecord'
      }, C.RECORD_ACTIONS.RECORD_DELETE_ERROR)

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.deletionMsg, callback
    )

    setTimeout(() => {
      expect(recordDeletion.isDestroyed).toBe(true)
      expect(callback).not.toHaveBeenCalled()
      expect(services.logger.log.calls.argsFor(0)).toEqual([3, C.RECORD_ACTIONS[C.RECORD_ACTIONS.RECORD_DELETE_ERROR], 'storageError'])
      done()
    }, 20)
  })

  it('encounters an ack delete timeout', (done) => {
    config.cacheRetrievalTimeout = 10
    services.cache.nextOperationWillBeSuccessful = false
    services.cache.nextOperationWillBeSynchronous = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.DELETE,
        name: 'someRecord'
      }, C.RECORD_ACTIONS.RECORD_DELETE_ERROR)

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.deletionMsg, callback
    )

    setTimeout(() => {
      expect(recordDeletion.isDestroyed).toBe(true)
      expect(callback).not.toHaveBeenCalled()
      expect(services.logger.log.calls.argsFor(0)).toEqual([3, C.RECORD_ACTIONS[C.RECORD_ACTIONS.RECORD_DELETE_ERROR], 'cache timeout'])
      done()
    }, 100)
  })

  it('doesn\'t delete excluded messages from storage', () => {
    config.storageExclusion = new RegExp('no-storage/')

    client.socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs(M.anotherDeletionMsg)

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.anotherDeletionMsg, callback
    )

    expect(services.cache.completedDeleteOperations).toBe(1)
    expect(services.storage.completedDeleteOperations).toBe(0)
    expect(recordDeletion.isDestroyed).toBe(true)
    expect(callback).toHaveBeenCalled()
  })
})
