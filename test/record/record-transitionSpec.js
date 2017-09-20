/* eslint-disable max-len, import/no-extraneous-dependencies */
'use strict'

/* global it, describe, expect, jasmine, beforeAll */
const proxyquire = require('proxyquire').noPreserveCache()
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const SocketMock = require('../mocks/socket-mock')
const testHelper = require('../test-helper/test-helper')
const LoggerMock = require('../mocks/logger-mock')

const msg = testHelper.msg
const recordRequestMock = jasmine.createSpy()
const patchMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 1, 'firstname', 'SEgon'] }
const recordHandlerMock = {
  _$broadcastUpdate: jasmine.createSpy(),
  _$transitionComplete: jasmine.createSpy()
}
const RecordTransition = proxyquire('../../src/record/record-transition', { './record-request': recordRequestMock })

let options
let recordTransition
let socketWrapper

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

describe('record transitions', () => {

  describe('happy path', () => {
    beforeAll(() => createRecordTransition())

    it('retrieves the empty record', () => {
      expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalled()
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      recordRequestMockCallback()
      expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage, false, socketWrapper)
      expect(recordHandlerMock._$transitionComplete).toHaveBeenCalledWith('recordName')
    })
  })

  describe('multiple steps', () => {
    const patchMessage2 = { topic: 'RECORD', action: 'P', data: ['recordName', 3, 'firstname', 'SLana'] }
    const updateMessage = { topic: 'RECORD', action: 'U', data: ['recordName', 2, '{ "lastname": "Peterson" }'] }

    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = false
    })

    it('adds an update to the queue', () => {
      expect(recordTransition._steps.length).toBe(1)
      recordTransition.add(socketWrapper, 2, updateMessage)
      expect(recordTransition._steps.length).toBe(2)
    })

    it('adds a message with invalid data to the queue', () => {
      socketWrapper.socket.lastSendMessage = null
      recordTransition.add(socketWrapper, 3, {
        topic: 'RECORD',
        action: 'U',
        data: [1]
      })
      expect(recordTransition._steps.length).toBe(2)
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
    })

    it('adds a message with broken data to the queue', () => {
      socketWrapper.socket.lastSendMessage = null
      recordTransition.add(socketWrapper, 3, {
        topic: 'RECORD',
        action: 'U',
        data: ['recordName', 2, '{ "lastname": "Peterson']
      })
      expect(recordTransition._steps.length).toBe(2)
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
    })

    it('adds a message with null data to the queue', () => {
      socketWrapper.socket.lastSendMessage = null
      recordTransition.add(socketWrapper, 3, {
        topic: 'RECORD',
        action: 'U',
        data: ['recordName', 3, 'null']
      })
      expect(recordTransition._steps.length).toBe(2)
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
    })

    it('adds a message with string data to the queue', () => {
      socketWrapper.socket.lastSendMessage = null
      recordTransition.add(socketWrapper, 3, {
        topic: 'RECORD',
        action: 'U',
        data: ['recordName', 3, 'This is a string']
      })
      expect(recordTransition._steps.length).toBe(2)
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
    })

    it('adds a message with numeric data to the queue', () => {
      socketWrapper.socket.lastSendMessage = null
      recordTransition.add(socketWrapper, 3, {
        topic: 'RECORD',
        action: 'U',
        data: ['recordName', 3, 100.23]
      })
      expect(recordTransition._steps.length).toBe(2)
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
    })

    it('retrieves the empty record', (done) => {
      expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalled()
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      expect(recordTransition._steps.length).toBe(2)
      expect(recordTransition._record).toBe(null)

      recordRequestMockCallback({ _v: 0, _d: { firstname: 'Egon' } })

      expect(recordTransition._record).toEqual({ _v: 1, _d: { firstname: 'Egon' } })
      expect(options.cache.completedSetOperations).toBe(0)

      const check = setInterval(() => {
        if (options.cache.completedSetOperations === 1) {
          expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage, false, socketWrapper)
          expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
          expect(recordTransition._record).toEqual({ _v: 2, _d: { lastname: 'Peterson' } })
          clearInterval(check)
          done()
        }
      }, 1)
    })

    it('receives a patch message whilst the transition is in progress', () => {
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      recordTransition.add(socketWrapper, 3, patchMessage2)
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
          expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', updateMessage, false, socketWrapper)
          expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalledWith('recordName', patchMessage2, false, socketWrapper)
          expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
          expect(recordTransition._record).toEqual({ _v: 3, _d: { firstname: 'Lana', lastname: 'Peterson' } })
          clearInterval(check)
          done()
        }
      }, 1)
    })

    it('processes the final step in the queue', (done) => {
      const check = setInterval(() => {
        if (options.cache.completedSetOperations === 3) {
          expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage2, false, socketWrapper)
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
  })

  describe('does not store excluded data', () => {
    beforeAll(() => createRecordTransition('no-storage/1', patchMessage))

    it('retrieves the empty record', () => {
      expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalled()
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      recordRequestMockCallback()
      expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('no-storage/1', patchMessage, false, socketWrapper)
      expect(recordHandlerMock._$transitionComplete).toHaveBeenCalledWith('no-storage/1')
    })

    it('does not store transition in storage', (done) => {
      const check = setInterval(() => {
        if (options.storage.completedSetOperations === 0) {
          clearInterval(check)
          done()
        }
      }, 1)
    })
  })

  describe('destroys a transition between steps', () => {
    const secondPatchMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'firstname', 'SEgon'] }

    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = false
    })

    it('adds a patch to the queue', () => {
      expect(() => {
        recordTransition.add(socketWrapper, 2, secondPatchMessage)
        expect(recordTransition.hasVersion(2)).toBe(true)
      }).not.toThrow()
    })
  })

  describe('tries to set a record, but both cache and storage fail', () => {
    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = true
      options.cache.nextOperationWillBeSuccessful = false
      options.storage.nextOperationWillBeSuccessful = false
      recordRequestMockCallback()
    })

    it('logged an error', () => {
      expect(options.logger.log).toHaveBeenCalledWith(3, 'RECORD_UPDATE_ERROR', 'storageError')
    })
  })

  describe('destroys the transition', () => {
    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = false
    })

    it('destroys the transition', (done) => {
      recordTransition.destroy()
      expect(recordTransition.isDestroyed).toBe(true)
      expect(recordTransition._steps).toBe(null)
      setTimeout(() => {
        // just leave this here to make sure no error is thrown when the
        // record request returns after 30ms
        done()
      }, 50)
    })

    it('calls destroy a second time without causing problems', () => {
      recordTransition.destroy()
      expect(recordTransition.isDestroyed).toBe(true)
      expect(recordTransition._steps).toBe(null)
    })
  })

  describe('recordRequest returns an error', () => {
    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = false
    })

    it('receives an error', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(null)
      recordRequestMockCallback('errorMsg', true)
      expect(options.logger.log).toHaveBeenCalledWith(3, 'RECORD_UPDATE_ERROR', 'errorMsg')
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_UPDATE_ERROR|1+'))
    })
  })

  describe('recordRequest returns null', () => {
    beforeAll(() => {
      createRecordTransition()
      options.cache.nextOperationWillBeSynchronous = false
    })

    it('receives a non existant error', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(null)
      recordRequestMockCallback(null)
      expect(options.logger.log).toHaveBeenCalledWith(3, 'RECORD_UPDATE_ERROR', 'Received update for non-existant record recordName')
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_UPDATE_ERROR|1+'))
    })
  })

  describe('handles invalid message data', () => {
    const invalidPatchMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'somepath', 'O{"invalid":"json'] }

    beforeAll(() => {
      createRecordTransition('recordName', invalidPatchMessage)
      options.cache.nextOperationWillBeSynchronous = false
    })

    it('receives an error', () => {
      expect(socketWrapper.socket.lastSendMessage).toContain(msg('R|E|INVALID_MESSAGE_DATA|'))
    })
  })

  describe('transition version conflicts', () => {
    const socketMock1 = new SocketMock()
    const socketMock2 = new SocketMock()
    const socketMock3 = new SocketMock()
    const socketWrapper1 = new SocketWrapper(socketMock1, {})
    const socketWrapper2 = new SocketWrapper(socketMock2, {})
    const socketWrapper3 = new SocketWrapper(socketMock3, {})
    const patchMessage2 = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'firstname', 'SEgon'] }

    beforeAll(() => {
      createRecordTransition('recordName')
      options.cache.nextOperationWillBeSynchronous = false
    })

    it('gets a version exist error on two seperate updates but does not send error', () => {
      recordTransition.add(socketWrapper1, 2, patchMessage2)

      recordTransition.sendVersionExists({ sender: socketWrapper1, version: 1, message: patchMessage })
      recordTransition.sendVersionExists({ sender: socketWrapper2, version: 1, message: patchMessage2 })

      expect(socketMock1.lastSendMessage).toBeNull()
      expect(socketMock2.lastSendMessage).toBeNull()
      expect(socketMock3.lastSendMessage).toBeNull()
    })

    it('sends version exists error once record request is completed is retrieved', () => {
      recordRequestMockCallback({ _v: 1, _d: { lastname: 'Kowalski' } })

      expect(socketMock1.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|recordName|1|{"lastname":"Kowalski"}+'))
      expect(socketMock2.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|recordName|1|{"lastname":"Kowalski"}+'))
      expect(socketMock3.lastSendMessage).toBeNull()
    })

    it('immediately sends version exists when record is already loaded', () => {
      socketMock1.lastSendMessage = null
      socketMock2.lastSendMessage = null
      socketMock3.lastSendMessage = null

      recordTransition.sendVersionExists({ sender: socketWrapper3, version: 1, message: patchMessage })

      expect(socketMock1.lastSendMessage).toBeNull()
      expect(socketMock2.lastSendMessage).toBeNull()
      expect(socketMock3.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|recordName|2|{"lastname":"Kowalski","firstname":"Egon"}+'))
    })

    it('destroys the transition', (done) => {
      recordTransition.destroy()
      expect(recordTransition.isDestroyed).toBe(true)
      expect(recordTransition._steps).toBe(null)
      setTimeout(() => {
        // just leave this here to make sure no error is thrown when the
        // record request returns after 30ms
        done()
      }, 50)
    })
  })
})
