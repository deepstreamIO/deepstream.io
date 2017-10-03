/* eslint-disable import/no-extraneous-dependencies */
'use strict'

/* global it, describe, expect, jasmine, afterAll, beforeAll */
const M = require('./messages')
const C = require('../../dist/src/constants')
const getTestMocks = require('../test-helper/test-mocks')
const testHelper = require('../test-helper/test-helper')

const RecordTransition = require('../../dist/src/record/record-transition').default

const sinon = require('sinon')

xdescribe('record write acknowledgement', () => {
  let options
  let socketWrapper
  let recordTransition
  let testMocks
  let client

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()

    options = testHelper.getDeepstreamOptions()

    recordTransition = new RecordTransition(M.recordUpdate.name, options, testMocks.recordHandler)
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

    recordTransition.add(client.socketWrapper, M.recordUpdate, true)
  })

  it('sends write failure to socket', () => {
    options.storage.nextOperationWillBeSuccessful = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(recordUpdate, C.EVENT.RECORD_UPDATE_ERROR)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({})

    // expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|recordName|[1]|SstorageError+'))
    recordTransition.add(client.socketWrapper, recordUpdate, true)
  })

  it('returns hasVersion for 1,2 and 3', () => {
    recordTransition.add(socketWrapper, 3, patchMessage3)

    expect(recordTransition.hasVersion(0)).toBe(true)
    expect(recordTransition.hasVersion(1)).toBe(true)
    expect(recordTransition.hasVersion(2)).toBe(true)
    expect(recordTransition.hasVersion(3)).toBe(true)
    expect(recordTransition.hasVersion(4)).toBe(false)
    expect(recordTransition.hasVersion(5)).toBe(false)

    //
  })

  it('multiple write acknowledgements', () => {
      // processes the next step in the queue
    const check = setInterval(() => {
      if (options.cache.completedSetOperations === 2) {
        expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage2, false, socketWrapper2)
        expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
        expect(recordTransition._record).toEqual({ _v: 3, _d: { firstname: 'Lana', lastname: 'Kowalski' } })
        clearInterval(check)
        done()
      }
    }, 1)

    // processes the final step in the queue
    if (options.cache.completedSetOperations === 3) {
      expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage3, false, socketWrapper)
      expect(recordHandlerMock._$transitionComplete).toHaveBeenCalled()
    }

    // stored each transition in storage
    // options.storage.completedSetOperations === 3

    // sent write acknowledgement to each client
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|recordName|[1,3]|L+'))
    expect(socketWrapper2.socket.lastSendMessage).toBe(msg('R|WA|recordName|[2]|L+'))
  })

  it('transition version conflicts gets a version exist error on record retrieval', () => {
  //   options.cache.nextOperationWillBeSynchronous = false
  //   recordTransition.add(socketWrapper, 2, updateMessage)
    expect(socketWrapper.socket.lastSendMessage).toBeNull()
    recordRequestMockCallback({ _v: 1, _d: { lastname: 'Kowalski' } })
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|recordName|1|{"lastname":"Kowalski"}|{"writeSuccess":true}+'))
  })
})
