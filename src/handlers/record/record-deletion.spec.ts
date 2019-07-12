import 'mocha'
import { expect } from 'chai'
import {spy} from 'sinon'

import RecordDeletion from './record-deletion'

import * as M from './test-messages'
import * as C from '../../../src/constants'
import * as testHelper from '../../test/helper/test-helper'
import { getTestMocks } from '../../test/helper/test-mocks'

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
    callback = spy()
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('deletes records - happy path', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.deletionSuccessMsg)

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.deletionMsg, callback
    )

    expect(services.cache.completedDeleteOperations).to.equal(1)
    expect(services.storage.completedDeleteOperations).to.equal(1)

    expect(recordDeletion.isDestroyed).to.equal(true)
    expect(callback).to.have.callCount(1)
  })

  it('encounters an error during record deletion', (done) => {
    services.cache.nextOperationWillBeSuccessful = false
    services.cache.nextOperationWillBeSynchronous = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.RECORD_DELETE_ERROR,
        name: 'someRecord'
      })

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.deletionMsg, callback
    )

    setTimeout(() => {
      expect(recordDeletion.isDestroyed).to.equal(true)
      expect(callback).to.have.callCount(0)
      expect(services.logger.logSpy.firstCall.args).to.deep.equal([3, C.RECORD_ACTION[C.RECORD_ACTION.RECORD_DELETE_ERROR], 'storageError'])
      done()
    }, 20)
  })

  it('encounters an ack delete timeout', (done) => {
    config.record.cacheRetrievalTimeout = 10
    services.cache.nextOperationWillBeSuccessful = false
    services.cache.nextOperationWillBeSynchronous = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTION.RECORD_DELETE_ERROR,
        name: 'someRecord'
      })

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.deletionMsg, callback
    )

    setTimeout(() => {
      expect(recordDeletion.isDestroyed).to.equal(true)
      expect(callback).to.have.callCount(0)
      expect(services.logger.logSpy.firstCall.args).to.deep.equal([3, C.RECORD_ACTION[C.RECORD_ACTION.RECORD_DELETE_ERROR], 'cache timeout'])
      done()
    }, 100)
  })

  it('doesn\'t delete excluded messages from storage', () => {
    config.record.storageExclusionPrefixes = ['no-storage/']

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.anotherDeletionSuccessMsg)

    recordDeletion = new RecordDeletion(
      config, services, client.socketWrapper, M.anotherDeletionMsg, callback
    )

    expect(services.cache.completedDeleteOperations).to.equal(1)
    expect(services.storage.completedDeleteOperations).to.equal(0)
    expect(recordDeletion.isDestroyed).to.equal(true)
    expect(callback).to.have.callCount(1)
  })
})
