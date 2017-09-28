/* import/no-extraneous-dependencies */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RecordDeletion = require('../../src/record/record-deletion')

const C = require('../../src/constants/constants')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

const deletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.ACTIONS.DELETE,
  name: 'someRecord'
}
const anotherDeletionMsg = {
  topic: C.TOPIC.RECORD,
  action: C.ACTIONS.DELETE,
  name: 'no-storage/1'
}

describe('record deletion', () => {
  let testMocks
  let recordDeletion
  let client
  let options
  let callback

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()
    options = testHelper.getDeepstreamOptions()
    callback = jasmine.createSpy('callback')
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('deletes records - happy path', () => {
    client.socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs(deletionMsg)

    recordDeletion = new RecordDeletion(
      options, client.socketWrapper, deletionMsg, callback
    )

    expect(options.cache.completedDeleteOperations).toBe(1)
    expect(options.storage.completedDeleteOperations).toBe(1)

    expect(recordDeletion._isDestroyed).toBe(true)
    expect(callback).toHaveBeenCalled()
  })

  it('encounters an error during record deletion', (done) => {
    options.cache.nextOperationWillBeSuccessful = false
    options.cache.nextOperationWillBeSynchronous = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.DELETE,
        name: 'someRecord'
      }, C.EVENT.RECORD_DELETE_ERROR)

    recordDeletion = new RecordDeletion(
      options, client.socketWrapper, deletionMsg, callback
    )

    setTimeout(() => {
      expect(recordDeletion._isDestroyed).toBe(true)
      expect(callback).not.toHaveBeenCalled()
      expect(options.logger.log.calls.argsFor(0)).toEqual([3, 'RECORD_DELETE_ERROR', 'storageError'])
      done()
    }, 20)
  })

  it('encounters an ack delete timeout', (done) => {
    options.cacheRetrievalTimeout = 10
    options.cache.nextOperationWillBeSuccessful = false
    options.cache.nextOperationWillBeSynchronous = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.DELETE,
        name: 'someRecord'
      }, C.EVENT.RECORD_DELETE_ERROR)

    recordDeletion = new RecordDeletion(
      options, client.socketWrapper, deletionMsg, callback
    )

    setTimeout(() => {
      expect(recordDeletion._isDestroyed).toBe(true)
      expect(callback).not.toHaveBeenCalled()
      expect(options.logger.log.calls.argsFor(0)).toEqual([3, 'RECORD_DELETE_ERROR', 'cache timeout'])
      done()
    }, 100)
  })

  it('doesn\'t delete excluded messages from storage', () => {
    options.storageExclusion = new RegExp('no-storage/')

    client.socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs(anotherDeletionMsg)

    recordDeletion = new RecordDeletion(
      options, client.socketWrapper, anotherDeletionMsg, callback
    )

    expect(options.cache.completedDeleteOperations).toBe(1)
    expect(options.storage.completedDeleteOperations).toBe(0)
    expect(recordDeletion._isDestroyed).toBe(true)
    expect(callback).toHaveBeenCalled()
  })
})
