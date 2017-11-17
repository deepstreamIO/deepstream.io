/*
const sinon = require('sinon')

const M = require('./messages')
import * as C from '../../src/constants'
import { getTestMocks } from '../test-helper/test-mocks'
const testHelper = require('../test-helper/test-helper')

const RecordTransition = require('../../src/record/record-transition').default

xdescribe('record transitions', () => {
  let services
  let config
  let socketWrapper
  let recordTransition
  let testMocks
  let client

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()

    const options = testHelper.getDeepstreamOptions()
    services = options.services
    config = options.config

    recordTransition = new RecordTransition(M.recordUpdate.name, config, services, testMocks.recordHandler)

    services.cache.set('some-record', M.recordData, () => {})
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
    testMocks.recordHandlerMock.verify()
  })

  it('retrieves the empty record', () => {
    testMocks.recordHandlerMock
      .expects('broadcastUpdate')
      .once()
      .withExactArgs(M.recordUpdate.name, M.recordUpdate, false, client.socketWrapper)

    testMocks.recordHandlerMock
      .expects('transitionComplete')
      .once()
      .withExactArgs(M.recordUpdate.name)

    recordTransition.add(client.socketWrapper, Object.assign({}, M.recordUpdate))
  })

  it('adds an update to the queue', () => {
    services.cache.nextGetWillBeSynchronous = false

    expect(recordTransition.steps.length).toBe(0)
    recordTransition.add(client.socketWrapper, M.recordUpdate)
    expect(recordTransition.steps.length).toBe(1)
  })

  it('adds a message with invalid data to the queue', () => {
    const invalidMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'bob',
      version: 1,
      data: '{ b ]'
    }

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(invalidMessage, C.EVENT.INVALID_MESSAGE_DATA)

    recordTransition.add(client.socketWrapper, invalidMessage)
  })

  it('adds a message with null data to the queue', () => {
    const invalidMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'bob',
      version: 1,
      data: 'null'
    }

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(invalidMessage, C.EVENT.INVALID_MESSAGE_DATA)

    recordTransition.add(client.socketWrapper, invalidMessage)
  })

  it('adds a message with string data to the queue', () => {
    const invalidMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'bob',
      version: 1,
      data: 'This is a string'
    }

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(invalidMessage, C.EVENT.INVALID_MESSAGE_DATA)

    recordTransition.add(client.socketWrapper, invalidMessage)
  })

  it('adds a message with numeric data to the queue', () => {
    const invalidMessage = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.UPDATE,
      name: 'bob',
      version: 1,
      data: '1234'
    }

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(invalidMessage, C.EVENT.INVALID_MESSAGE_DATA)

    recordTransition.add(client.socketWrapper, invalidMessage)
  })

  xit('retrieves the empty record', (done) => {
    recordRequestMockCallback({ _v: 0, _d: { firstname: 'Egon' } })

    expect(recordTransition._record).toEqual({ _v: 1, _d: { firstname: 'Egon' } })
    expect(services.cache.completedSetOperations).toBe(0)

    const check = setInterval(() => {
      if (services.cache.completedSetOperations === 1) {
        expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('recordName', patchMessage, false, socketWrapper)
        expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
        expect(recordTransition._record).toEqual({ _v: 2, _d: { lastname: 'Peterson' } })
        clearInterval(check)
        done()
      }
    }, 1)
  })

  xit('receives a patch message whilst the transition is in progress', () => {
    expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
    recordTransition.add(socketWrapper, 3, patchMessage2)
  })

  it('returns hasVersion for 1,2 and 3', () => {
    services.cache.nextOperationWillBeSynchronous = false

    recordTransition.add(client.socketWrapper, M.recordUpdate)

    expect(recordTransition.hasVersion(0)).toBe(true)
    expect(recordTransition.hasVersion(1)).toBe(true)
    expect(recordTransition.hasVersion(2)).toBe(true)
    expect(recordTransition.hasVersion(3)).toBe(true)
    expect(recordTransition.hasVersion(4)).toBe(true)
    expect(recordTransition.hasVersion(5)).toBe(true)
    expect(recordTransition.hasVersion(6)).toBe(true)
    expect(recordTransition.hasVersion(7)).toBe(false)
    expect(recordTransition.hasVersion(8)).toBe(false)
  })

  xit('processes a queue', (done) => {
    testMocks.recordHandlerMock
      .expects('broadcastUpdate')
      .once()
      .withExactArgs(M.recordPatch.name, M.recordPatch, false, client.socketWrapper)

    testMocks.recordHandlerMock
      .expects('broadcastUpdate')
      .once()
      .withExactArgs(M.recordUpdate.name, M.recordUpdate, false, client.socketWrapper)

    testMocks.recordHandlerMock
      .expects('transitionComplete')
      .once()
      .withExactArgs(M.recordPatch.name)

    client.socketWrapperMock
      .expects('sendError')
      .never()

    recordTransition.add(client.socketWrapper, M.recordPatch)
    recordTransition.add(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: M.recordUpdate.version + 1 }))
    recordTransition.add(client.socketWrapper, Object.assign({}, M.recordUpdate, { version: M.recordUpdate.version + 2 }))
  })

  describe('does not store excluded data', () => {

    it('retrieves the empty record', () => {
      expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalled()
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      recordRequestMockCallback()
      expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('no-storage/1', patchMessage, false, socketWrapper)
      expect(recordHandlerMock._$transitionComplete).toHaveBeenCalledWith('no-storage/1')
    })

    it('does not store transition in storage', (done) => {
      const check = setInterval(() => {
        if (services.storage.completedSetOperations === 0) {
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
      services.cache.nextOperationWillBeSynchronous = false
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
      services.cache.nextOperationWillBeSynchronous = true
      services.cache.nextOperationWillBeSuccessful = false
      services.storage.nextOperationWillBeSuccessful = false
      recordRequestMockCallback()
    })

    it('logged an error', () => {
      expect(services.logger._log).toHaveBeenCalledWith(3, 'RECORD_UPDATE_ERROR', 'storageError')
    })
  })

  describe('destroys the transition', () => {
    beforeAll(() => {
      createRecordTransition()
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('destroys the transition', (done) => {
      recordTransition.destroy()
      expect(recordTransition.isDestroyed).toBe(true)
      expect(recordTransition.steps).toBe(null)
      setTimeout(() => {
        // just leave this here to make sure no error is thrown when the
        // record request returns after 30ms
        done()
      }, 50)
    })

    it('calls destroy a second time without causing problems', () => {
      recordTransition.destroy()
      expect(recordTransition.isDestroyed).toBe(true)
      expect(recordTransition.steps).toBe(null)
    })
  })

  describe('recordRequest returns an error', () => {
    beforeAll(() => {
      createRecordTransition()
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('receives an error', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(null)
      recordRequestMockCallback('errorMsg', true)
      expect(services.logger._log).toHaveBeenCalledWith(3, 'RECORD_UPDATE_ERROR', 'errorMsg')
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_UPDATE_ERROR|1+'))
    })
  })

  describe('recordRequest returns null', () => {
    beforeAll(() => {
      createRecordTransition()
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('receives a non existant error', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(null)
      recordRequestMockCallback(null)
      expect(services.logger._log).toHaveBeenCalledWith(3, 'RECORD_UPDATE_ERROR', 'Received update for non-existant record recordName')
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_UPDATE_ERROR|1+'))
    })
  })

  describe('handles invalid message data', () => {
    const invalidPatchMessage = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'somepath', 'O{"invalid":"json'] }

    beforeAll(() => {
      createRecordTransition('recordName', invalidPatchMessage)
      services.cache.nextOperationWillBeSynchronous = false
    })

    it('receives an error', () => {
      expect(socketWrapper.socket.lastSendMessage).toContain(msg('R|E|INVALID_MESSAGE_DATA|'))
    })
  })

  xdescribe('transition version conflicts', () => {
    const socketMock1 = new SocketMock()
    const socketMock2 = new SocketMock()
    const socketMock3 = new SocketMock()
    const socketWrapper1 = new SocketWrapper(socketMock1, {})
    const socketWrapper2 = new SocketWrapper(socketMock2, {})
    const socketWrapper3 = new SocketWrapper(socketMock3, {})
    const patchMessage2 = { topic: 'RECORD', action: 'P', data: ['recordName', 2, 'firstname', 'SEgon'] }

    beforeAll(() => {
      createRecordTransition('recordName')
      services.cache.nextOperationWillBeSynchronous = false
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
      expect(recordTransition.steps).toBe(null)
      setTimeout(() => {
        // just leave this here to make sure no error is thrown when the
        // record request returns after 30ms
        done()
      }, 50)
    })
  })
})
*/
//# sourceMappingURL=record-transitionSpec.js.map