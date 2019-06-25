/*
'use strict'

const M = require('./messages')
import * as C from '../../src/constants'
import { getTestMocks } from '../test-helper/test-mocks'
const testHelper = require('../test-helper/test-helper')

const RecordTransition = require('../../src/record/record-transition').default

const sinon = require('sinon')

describe('record write acknowledgement', () => {
  let config
  let services
  let socketWrapper
  let recordTransition
  let testMocks
  let client

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()

    const options = testHelper.getDeepstreamOptions()
    config = options.config
    services = options.services

    recordTransition = new RecordTransition(M.recordUpdate.name, config, services, testMocks.recordHandler)
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('sends write success to socket', () => {
    client.socketWrapperMock
      .expects('sendError')
      .never()

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.writeAck, true)

    recordTransition.add(client.socketWrapper, M.recordUpdateWithAck, true)
  })

  it('sends write failure to socket', () => {
    services.storage.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.recordUpdateWithAck, C.EVENT.RECORD_UPDATE_ERROR)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.RECORD,
        action: C.ACTIONS.WRITE_ACKNOWLEDGEMENT,
        name: M.recordUpdateWithAck.name,
        data: [[-1], C.EVENT.RECORD_LOAD_ERROR]
      }, true)

    recordTransition.add(client.socketWrapper, M.recordUpdateWithAck, true)
  })

  it.skip('multiple write acknowledgements', () => {
      // processes the next step in the queue
    const check = setInterval(() => {
      if (services.storage.completedSetOperations === 2) {
        expect(recordHandlerMock._$broadcastUpdate).to.have.been.calledWith('recordName', patchMessage2, false, socketWrapper2)
        expect(recordHandlerMock._$transitionComplete).to.have.callCount(0)
        expect(recordTransition._record).to.deep.equal({ _v: 3, _d: { firstname: 'Lana', lastname: 'Kowalski' } })
        clearInterval(check)
        done()
      }
    }, 1)

    // processes the final step in the queue
    if (services.storage.completedSetOperations === 3) {
      expect(recordHandlerMock._$broadcastUpdate).to.have.been.calledWith('recordName', patchMessage3, false, socketWrapper)
      expect(recordHandlerMock._$transitionComplete).to.have.callCount(1)
    }

    // stored each transition in storage
    // services.storage.completedSetOperations === 3

    // sent write acknowledgement to each client
    expect(socketWrapper.socket.lastSendMessage).to.equal(msg('R|WA|recordName|[1,3]|L+'))
    expect(socketWrapper2.socket.lastSendMessage).to.equal(msg('R|WA|recordName|[2]|L+'))
  })

  it.skip('transition version conflicts gets a version exist error on record retrieval', () => {
  //   services.storage.nextOperationWillBeSynchronous = false
  //   recordTransition.add(socketWrapper, 2, updateMessage)
    expect(socketWrapper.socket.lastSendMessage).to.equal(null)
    recordRequestMockCallback({ _v: 1, _d: { lastname: 'Kowalski' } })
    expect(socketWrapper.socket.lastSendMessage).to.equal(msg('R|E|VERSION_EXISTS|recordName|1|{"lastname":"Kowalski"}|{"writeSuccess":true}+'))
  })
})
*/
