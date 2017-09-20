/* eslint-disable import/no-extraneous-dependencies */
'use strict'

/* global it, describe, expect, jasmine, afterAll, beforeAll */
const proxyquire = require('proxyquire').noPreserveCache()
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const SocketMock = require('../mocks/socket-mock')
const testHelper = require('../test-helper/test-helper')
const LoggerMock = require('../mocks/logger-mock')

const patchMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 1, 'firstname', 'SEgon', '{"writeSuccess":true}'] }
const recordHandlerMock = {
  _$broadcastUpdate: jasmine.createSpy(),
  _$transitionComplete: jasmine.createSpy()
}
const recordRequestMock = jasmine.createSpy()
const RecordTransition = proxyquire('../../src/record/record-transition', { './record-request': recordRequestMock })

const msg = testHelper.msg

let options
let socketWrapper
let recordTransition

function recordRequestMockCallback (data, isError) {
  const callback = recordRequestMock.calls.mostRecent().args[isError ? 4 : 3]
  const context = recordRequestMock.calls.mostRecent().args[5]
  callback.call(context, data === undefined ? { _v: 0, _d: {} } : data)
}

function createRecordTransition (recordName, message) {
  options = testHelper.getDeepstreamOptions()
  options.logger = new LoggerMock()

  recordRequestMock.calls.reset()
  recordHandlerMock._$broadcastUpdate.calls.reset()
  recordHandlerMock._$transitionComplete.calls.reset()

  socketWrapper = new SocketWrapper(new SocketMock(), {})

  recordTransition = new RecordTransition(recordName || 'recordName', options, recordHandlerMock)
  expect(recordTransition.hasVersion).toBeDefined()
  expect(recordTransition.hasVersion(2)).toBe(false)

  expect(recordRequestMock).not.toHaveBeenCalled()
  recordTransition.add(socketWrapper, 1, message || patchMessage)
}

describe('record write acknowledgement', () => {

  describe('happy path', () => {
    beforeAll(() => {
      createRecordTransition()
      recordRequestMockCallback()
    })

    it('sends write success to socket', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|recordName|[1]|L+'))
    })
  })

  describe('write failure', () => {
    beforeAll(() => {
      createRecordTransition()
      options.storage.nextOperationWillBeSuccessful = false
      recordRequestMockCallback()
    })

    it('sends write failure to socket', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|recordName|[1]|SstorageError+'))
    })
  })

  describe('multiple write acknowledgements', () => {

    const socketWrapper2 = new SocketWrapper(new SocketMock(), {})
    const patchMessage2 = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'firstname', 'SJeff', '{"writeSuccess":true}'] }
    const patchMessage3 = { topic: 'RECORD', action: 'P', data: ['recordName', 3, 'firstname', 'SLana', '{"writeSuccess":true}'] }

    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = false
      recordTransition.add(socketWrapper2, 2, patchMessage2)
      recordRequestMockCallback({ _v: 0, _d: { lastname: 'Kowalski' } })
    })

    it('retrieves the empty record', () => {
      expect(options.cache.completedSetOperations).toBe(0)
    })

    it('receives a patch message whilst the transition is in progress', () => {
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      recordTransition.add(socketWrapper, 3, patchMessage3)
    })

    it('returns hasVersion for 1,2 and 3', () => {
      expect(recordTransition.hasVersion(0)).toBe(true)
      expect(recordTransition.hasVersion(1)).toBe(true)
      expect(recordTransition.hasVersion(2)).toBe(true)
      expect(recordTransition.hasVersion(3)).toBe(true)
      expect(recordTransition.hasVersion(4)).toBe(false)
      expect(recordTransition.hasVersion(5)).toBe(false)
    })

    it('processes the next step in the queue', (done) => {
      const check = setInterval(() => {
        if (options.cache.completedSetOperations === 2) {
          expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage2, false, socketWrapper2)
          expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
          expect(recordTransition._record).toEqual({ _v: 3, _d: { firstname: 'Lana', lastname: 'Kowalski' } })
          clearInterval(check)
          done()
        }
      }, 1)
    })

    it('processes the final step in the queue', (done) => {
      const check = setInterval(() => {
        if (options.cache.completedSetOperations === 3) {
          expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage3, false, socketWrapper)
          expect(recordHandlerMock._$transitionComplete).toHaveBeenCalled()
          clearInterval(check)
          done()
        }
      }, 1)
    })

    it('stored each transition in storage', (done) => {
      const check = setInterval(() => {
        if (options.storage.completedSetOperations === 3) {
          clearInterval(check)
          done()
        }
      }, 1)
    })

    it('sent write acknowledgement to each client', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|recordName|[1,3]|L+'))
      expect(socketWrapper2.socket.lastSendMessage).toBe(msg('R|WA|recordName|[2]|L+'))
    })

  })

  describe('transition version conflicts', () => {
    const updateMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'firstname', 'SEgon'] }

    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = false
      recordTransition.add(socketWrapper, 2, updateMessage)
    })

    it('gets a version exist error on record retrieval', () => {
      expect(socketWrapper.socket.lastSendMessage).toBeNull()
      recordRequestMockCallback({ _v: 1, _d: { lastname: 'Kowalski' } })
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|recordName|1|{"lastname":"Kowalski"}|{"writeSuccess":true}+'))
    })
  })
})
