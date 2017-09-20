/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const recordRequest = require('../../src/record/record-request')
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const SocketMock = require('../mocks/socket-mock')
const testHelper = require('../test-helper/test-helper')
const LoggerMock = require('../mocks/logger-mock')

const msg = testHelper.msg

describe('record request', () => {
  const completeCallback = jasmine.createSpy('completeCallback')
  const errorCallback = jasmine.createSpy('errorCallback')

  let socketWrapper
  let options

  beforeEach(() => {
    options = testHelper.getDeepstreamOptions()
    options = Object.assign(options, {
      cacheRetrievalTimeout: 100,
      storageRetrievalTimeout: 100,
      logger: new LoggerMock(),
      storageExclusion: new RegExp('dont-save')
    })
    options.cache.set('existingRecord', { _v: 1, _d: {} }, () => {})
    options.storage.set('onlyExistsInStorage', { _v: 1, _d: {} }, () => {})

    completeCallback.calls.reset()
    errorCallback.calls.reset()

    socketWrapper = new SocketWrapper(new SocketMock(), {})
  })

  describe('records are requested from cache and storage sequentially', () => {
    it('requests a record that exists in a synchronous cache', () => {
      options.cache.nextOperationWillBeSynchronous = true

      recordRequest(
        'existingRecord',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(options.cache.lastRequestedKey).toBe('existingRecord')
      expect(options.storage.lastRequestedKey).toBe(null)

      expect(completeCallback).toHaveBeenCalledWith(
        { _v: 1, _d: {} },
        'existingRecord',
        socketWrapper
        )
      expect(errorCallback).not.toHaveBeenCalled()
    })

    it('requests a record that exists in an asynchronous cache', (done) => {
      options.cache.nextGetWillBeSynchronous = false

      recordRequest(
        'existingRecord',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      setTimeout(() => {
        expect(completeCallback).toHaveBeenCalledWith(
          { _v: 1, _d: {} },
          'existingRecord',
          socketWrapper
          )
        expect(errorCallback).not.toHaveBeenCalled()
        expect(options.cache.lastRequestedKey).toBe('existingRecord')
        expect(options.storage.lastRequestedKey).toBe(null)
        done()
      }, 30)
    })

    it('requests a record that doesn\'t exists in a synchronous cache, but in storage', () => {
      options.cache.nextGetWillBeSynchronous = true

      recordRequest(
        'onlyExistsInStorage',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(options.cache.lastRequestedKey).toBe('onlyExistsInStorage')
      expect(options.storage.lastRequestedKey).toBe('onlyExistsInStorage')

      expect(completeCallback).toHaveBeenCalledWith(
        { _v: 1, _d: {} },
        'onlyExistsInStorage',
        socketWrapper
        )
      expect(errorCallback).not.toHaveBeenCalled()
    })

    it('requests a record that doesn\'t exists in an asynchronous cache, but in asynchronous storage', (done) => {
      options.cache.nextGetWillBeSynchronous = false
      options.storage.nextGetWillBeSynchronous = false

      recordRequest(
        'onlyExistsInStorage',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      setTimeout(() => {
        expect(options.cache.lastRequestedKey).toBe('onlyExistsInStorage')
        expect(options.storage.lastRequestedKey).toBe('onlyExistsInStorage')

        expect(errorCallback).not.toHaveBeenCalled()
        expect(completeCallback).toHaveBeenCalledWith(
          { _v: 1, _d: {} },
          'onlyExistsInStorage',
          socketWrapper
          )
        done()
      }, 75)
    })

    it('returns null for non existent records', () => {
      options.cache.nextGetWillBeSynchronous = true

      recordRequest(
        'doesNotExist',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(completeCallback).toHaveBeenCalledWith(
        null,
        'doesNotExist',
        socketWrapper
        )
      expect(errorCallback).not.toHaveBeenCalled()

      expect(options.cache.lastRequestedKey).toBe('doesNotExist')
      expect(options.storage.lastRequestedKey).toBe('doesNotExist')
    })

    it('handles cache errors', () => {
      options.cache.nextGetWillBeSynchronous = true
      options.cache.nextOperationWillBeSuccessful = false

      recordRequest(
        'cacheError',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(errorCallback).toHaveBeenCalledWith(
        'RECORD_LOAD_ERROR',
        'error while loading cacheError from cache:storageError',
        'cacheError',
        socketWrapper
        )
      expect(completeCallback).not.toHaveBeenCalled()

      expect(options.logger.log).toHaveBeenCalledWith(3, 'RECORD_LOAD_ERROR', 'error while loading cacheError from cache:storageError')
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_LOAD_ERROR|error while loading cacheError from cache:storageError+'))
    })

    it('handles storage errors', () => {
      options.cache.nextGetWillBeSynchronous = true
      options.cache.nextOperationWillBeSuccessful = true
      options.storage.nextGetWillBeSynchronous = true
      options.storage.nextOperationWillBeSuccessful = false

      recordRequest(
        'storageError',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(errorCallback).toHaveBeenCalledWith(
        'RECORD_LOAD_ERROR',
        'error while loading storageError from storage:storageError',
        'storageError',
        socketWrapper
        )
      expect(completeCallback).not.toHaveBeenCalled()

      expect(options.logger.log).toHaveBeenCalledWith(3, 'RECORD_LOAD_ERROR', 'error while loading storageError from storage:storageError')
      expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_LOAD_ERROR|error while loading storageError from storage:storageError+'))
    })

    describe('handles cache timeouts', () => {
      beforeEach(() => {
        options.cacheRetrievalTimeout = 1
        options.cache.nextGetWillBeSynchronous = false
        options.cache.nextOperationWillBeSuccessful = true
      })

      afterEach(() => {
        options.cacheRetrievalTimeout = 10
      })

      it('sends a CACHE_RETRIEVAL_TIMEOUT message when cache times out', (done) => {
        recordRequest(
          'willTimeoutCache',
          options,
          socketWrapper,
          completeCallback,
          errorCallback,
          null
        )

        setTimeout(() => {
          expect(errorCallback).toHaveBeenCalledWith(
            'CACHE_RETRIEVAL_TIMEOUT',
            'willTimeoutCache',
            'willTimeoutCache',
            socketWrapper
            )
          expect(completeCallback).not.toHaveBeenCalled()

          // ignores update from cache that may occur afterwards
          options.cache.triggerLastGetCallback(null, '{ data: "value" }')
          expect(completeCallback).not.toHaveBeenCalled()

          done()
        }, 1)
      })
    })

    describe('handles storage timeouts', () => {
      beforeEach(() => {
        options.storageRetrievalTimeout = 1
        options.cache.nextGetWillBeSynchronous = true
        options.cache.nextOperationWillBeSuccessful = true
        options.storage.nextGetWillBeSynchronous = false
        options.storage.nextOperationWillBeSuccessful = true
      })

      it('sends a STORAGE_RETRIEVAL_TIMEOUT message when storage times out', (done) => {
        recordRequest(
          'willTimeoutStorage',
          options,
          socketWrapper,
          completeCallback,
          errorCallback,
          null
        )

        setTimeout(() => {
          expect(errorCallback).toHaveBeenCalledWith(
            'STORAGE_RETRIEVAL_TIMEOUT',
            'willTimeoutStorage',
            'willTimeoutStorage',
            socketWrapper
          )
          expect(completeCallback).not.toHaveBeenCalled()

          // ignores update from storage that may occur afterwards
          options.storage.triggerLastGetCallback(null, '{ data: "value" }')
          expect(completeCallback).not.toHaveBeenCalled()

          done()
        }, 1)
      })
    })
  })

  describe('excluded records are not put into storage', () => {
    beforeEach(() => {
      options.cache.nextGetWillBeSynchronous = true
      options.storage.nextGetWillBeSynchronous = true
      options.storage.delete = jasmine.createSpy('storage.delete')
      options.storage.set('dont-save/1', { _v: 1, _d: {} }, () => {})
    })

    it('returns null when requesting a record that doesn\'t exists in a synchronous cache, and is excluded from storage', (done) => {
      recordRequest(
        'dont-save/1',
        options,
        socketWrapper,
        completeCallback,
        errorCallback,
        null
      )

      expect(completeCallback).toHaveBeenCalledWith(
        null,
        'dont-save/1',
        socketWrapper
      )
      expect(errorCallback).not.toHaveBeenCalled()
      expect(options.storage.lastRequestedKey).toBeNull()
      done()
    })
  })
})
