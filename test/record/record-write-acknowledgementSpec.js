'use strict'

/* global it, describe, expect, jasmine */
const proxyquire = require('proxyquire')
const RecordRequestMock = require('../mocks/record-request-mock')
const RecordTransition = proxyquire('../../src/record/record-transition', { './record-request': RecordRequestMock })
const SocketWrapper = require('../../src/message/socket-wrapper')
const SocketMock = require('../mocks/socket-mock')
const msg = require('../test-helper/test-helper').msg
const StorageMock = require('../mocks/storage-mock')

describe('record write acknowledgement', () => {

  describe('happy path', () => {
    let recordTransition,
      socketWrapper = new SocketWrapper(new SocketMock(), {}),
      patchMessage = { topic: 'RECORD', action: 'P', data: ['someRecord', 1, 'firstname', 'SEgon', '{"writeSuccess":true}'] },
      recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
      options = { cache: new StorageMock(), storage: new StorageMock() }

    it('creates the transition', () => {
      recordTransition = new RecordTransition('someRecord', options, recordHandlerMock)
      expect(recordTransition.hasVersion).toBeDefined()
      expect(recordTransition.hasVersion(2)).toBe(false)
    })

    it('adds a patch to the queue', () => {
      expect(recordTransition._recordRequest).toBe(null)
      recordTransition.add(socketWrapper, 1, patchMessage)
      expect(recordTransition._recordRequest).toBeDefined()
      expect(recordTransition._recordRequest.recordName).toBe('someRecord')
    })

    it('retrieves the empty record', () => {
      expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalled()
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      recordTransition._recordRequest.onComplete({ _v: 0, _d: {} })
      expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('someRecord', patchMessage, socketWrapper)
      expect(recordHandlerMock._$transitionComplete).toHaveBeenCalledWith('someRecord')
    })

    it('sends write success to socket', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|someRecord|[1]|L+'))
    })
  })

  describe('write failure', () => {
    let recordTransition,
      socketWrapper = new SocketWrapper(new SocketMock(), {}),
      patchMessage = { topic: 'RECORD', action: 'P', data: ['someRecord', 1, 'firstname', 'SEgon', '{"writeSuccess":true}'] },
      recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
      options = { cache: new StorageMock(), storage: new StorageMock(), logger: { log: jasmine.createSpy('log') } }
    options.storage.nextOperationWillBeSuccessful = false

    it('creates the transition', () => {
      recordTransition = new RecordTransition('someRecord', options, recordHandlerMock)
      expect(recordTransition.hasVersion).toBeDefined()
      expect(recordTransition.hasVersion(2)).toBe(false)
    })

    it('adds a patch to the queue', () => {
      expect(recordTransition._recordRequest).toBe(null)
      recordTransition.add(socketWrapper, 1, patchMessage)
      expect(recordTransition._recordRequest).toBeDefined()
      expect(recordTransition._recordRequest.recordName).toBe('someRecord')
    })

    it('retrieves the empty record', () => {
      expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalled()
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      recordTransition._recordRequest.onComplete({ _v: 0, _d: {} })
      expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('someRecord', patchMessage, socketWrapper)
      expect(recordHandlerMock._$transitionComplete).toHaveBeenCalledWith('someRecord')
    })

    it('sends write failure to socket', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|someRecord|[1]|SstorageError+'))
    })
  })

  describe('multiple write acknowledgements', () => {
    let recordTransition,
      socketWrapper = new SocketWrapper(new SocketMock(), {}),
      socketWrapper2 = new SocketWrapper(new SocketMock(), {}),
      patchMessage = { topic: 'RECORD', action: 'P', data: ['someRecord', 1, 'firstname', 'SEgon', '{"writeSuccess":true}'] },
      patchMessage2 = { topic: 'RECORD', action: 'P', data: ['someRecord', 2, 'firstname', 'SJeff', '{"writeSuccess":true}'] },
      patchMessage3 = { topic: 'RECORD', action: 'P', data: ['someRecord', 3, 'firstname', 'SLana', '{"writeSuccess":true}'] },
      updateMessage = { topic: 'RECORD', action: 'U', data: ['someRecord', 2, '{ "lastname": "Peterson" }'] },
      recordHandlerMock = {
        _$broadcastUpdate: jasmine.createSpy('_$broadcastUpdate'),
        _$transitionComplete: jasmine.createSpy('_$transitionComplete') },
      options = { cache: new StorageMock(), storage: new StorageMock() }

    options.cache.nextOperationWillBeSynchronous = false

    it('creates the transition', () => {
      recordTransition = new RecordTransition('someRecord', options, recordHandlerMock)
      expect(recordTransition._record).toBe(null)
      expect(recordTransition.hasVersion).toBeDefined()
      expect(recordTransition.hasVersion(2)).toBe(false)
    })

    it('adds some patches to the queue', () => {
      expect(recordTransition._recordRequest).toBe(null)
      recordTransition.add(socketWrapper, 1, patchMessage)
      recordTransition.add(socketWrapper2, 2, patchMessage2)
      expect(recordTransition._recordRequest).toBeDefined()
      expect(recordTransition._recordRequest.recordName).toBe('someRecord')
      expect(recordTransition._record).toBe(null)
    })

    it('retrieves the empty record', () => {
      expect(recordHandlerMock._$broadcastUpdate).not.toHaveBeenCalled()
      expect(recordHandlerMock._$transitionComplete).not.toHaveBeenCalled()
      expect(recordTransition._steps.length).toBe(2)
      expect(recordTransition._record).toBe(null)
      recordTransition._recordRequest.onComplete({ _v: 0, _d: { lastname: 'Kowalski' } })
      expect(recordTransition._record).toEqual({ _v: 1, _d: { firstname: 'Egon', lastname: 'Kowalski' } })
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
          expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('someRecord', patchMessage2, socketWrapper2)
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
          expect(recordHandlerMock._$broadcastUpdate).toHaveBeenCalledWith('someRecord', patchMessage3, socketWrapper)
          expect(recordHandlerMock._$transitionComplete).toHaveBeenCalled()
          clearInterval(check)
          done()
        }
      }, 1)
    })

    it('stored each transition in storage', (done) => {
      const check = setInterval(() => {
        if (options.storage.completedSetOperations === 3) {
          done()
        }
      }, 1)
    })

    it('sent write acknowledgement to each client', () => {
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|WA|someRecord|[1,3]|L+'))
      expect(socketWrapper2.socket.lastSendMessage).toBe(msg('R|WA|someRecord|[2]|L+'))
    })

  })

  describe('transition version conflicts', () => {

    let recordTransition,
      socketMock1 = new SocketMock(),
      socketMock2 = new SocketMock(),
      socketMock3 = new SocketMock(),
      socketWrapper1 = new SocketWrapper(socketMock1, {}),
      socketWrapper2 = new SocketWrapper(socketMock2, {}),
      socketWrapper3 = new SocketWrapper(socketMock3, {}),
      patchMessage = { topic: 'RECORD', action: 'P', data: ['someRecord', 1, 'firstname', 'SEgon'] },
      updateMessage = { topic: 'RECORD', action: 'P', data: ['someRecord', 2, 'firstname', 'SEgon'] },
      recordHandlerMock = { _$broadcastUpdate: jasmine.createSpy(), _$transitionComplete: jasmine.createSpy() },
      options = { cache: new StorageMock(), storage: new StorageMock(), logger: { log: jasmine.createSpy('log') } }

    options.cache.nextOperationWillBeSynchronous = false

    it('creates the transition', () => {
      recordTransition = new RecordTransition('someRecord', options, recordHandlerMock)
      expect(recordTransition.hasVersion).toBeDefined()
      expect(recordTransition.hasVersion(2)).toBe(false)
    })

    it('adds a patch to the queue', () => {
      expect(recordTransition._recordRequest).toBe(null)
      recordTransition.add(socketWrapper1, 1, patchMessage)
      expect(recordTransition._recordRequest).toBeDefined()
      expect(recordTransition._recordRequest.recordName).toBe('someRecord')
    })

    it('gets a version exist error on record retrieval', () => {
      expect(socketMock1.lastSendMessage).toBeNull()
      recordTransition._recordRequest.onComplete({ _v: 1, _d: { lastname: 'Kowalski' } })
      expect(socketMock1.lastSendMessage).toBe(msg('R|E|VERSION_EXISTS|someRecord|1|{"lastname":"Kowalski"}+'))
    })
  })

})
