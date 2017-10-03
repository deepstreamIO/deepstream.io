/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const recordRequest = require('../../dist/src/record/record-request').default

const getTestMocks = require('../test-helper/test-mocks')
const testHelper = require('../test-helper/test-helper')
const LoggerMock = require('../test-mocks/logger-mock')

describe('record request', () => {
  const completeCallback = jasmine.createSpy('completeCallback')
  const errorCallback = jasmine.createSpy('errorCallback')

  let testMocks
  let client
  let options

  beforeEach(() => {
    options = testHelper.getDeepstreamOptions()
    options.config = Object.assign({}, options.config, {
      cacheRetrievalTimeout: 100,
      storageRetrievalTimeout: 100,
      storageExclusion: new RegExp('dont-save')
    })
    options.services.cache.set('existingRecord', { _v: 1, _d: {} }, () => {})
    options.services.storage.set('onlyExistsInStorage', { _v: 1, _d: {} }, () => {})

    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper('someUser')

    completeCallback.calls.reset()
    errorCallback.calls.reset()
  })

  describe('records are requested from cache and storage sequentially', () => {
    it('requests a record that exists in a synchronous cache', () => {
      options.services.cache.nextOperationWillBeSynchronous = true

      recordRequest(
        'existingRecord',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(options.services.cache.lastRequestedKey).toBe('existingRecord')
      expect(options.services.storage.lastRequestedKey).toBe(null)

      expect(completeCallback).toHaveBeenCalledWith(
        { _v: 1, _d: {} },
        'existingRecord',
        client.socketWrapper
        )
      expect(errorCallback).not.toHaveBeenCalled()
    })

    it('requests a record that exists in an asynchronous cache', (done) => {
      options.services.cache.nextGetWillBeSynchronous = false

      recordRequest(
        'existingRecord',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      setTimeout(() => {
        expect(completeCallback).toHaveBeenCalledWith(
          { _v: 1, _d: {} },
          'existingRecord',
          client.socketWrapper
          )
        expect(errorCallback).not.toHaveBeenCalled()
        expect(options.services.cache.lastRequestedKey).toBe('existingRecord')
        expect(options.services.storage.lastRequestedKey).toBe(null)
        done()
      }, 30)
    })

    it('requests a record that doesn\'t exists in a synchronous cache, but in storage', () => {
      options.services.cache.nextGetWillBeSynchronous = true

      recordRequest(
        'onlyExistsInStorage',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(options.services.cache.lastRequestedKey).toBe('onlyExistsInStorage')
      expect(options.services.storage.lastRequestedKey).toBe('onlyExistsInStorage')

      expect(completeCallback).toHaveBeenCalledWith(
        { _v: 1, _d: {} },
        'onlyExistsInStorage',
        client.socketWrapper
        )
      expect(errorCallback).not.toHaveBeenCalled()
    })

    it('requests a record that doesn\'t exists in an asynchronous cache, but in asynchronous storage', (done) => {
      options.services.cache.nextGetWillBeSynchronous = false
      options.services.storage.nextGetWillBeSynchronous = false

      recordRequest(
        'onlyExistsInStorage',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      setTimeout(() => {
        expect(options.services.cache.lastRequestedKey).toBe('onlyExistsInStorage')
        expect(options.services.storage.lastRequestedKey).toBe('onlyExistsInStorage')

        expect(errorCallback).not.toHaveBeenCalled()
        expect(completeCallback).toHaveBeenCalledWith(
          { _v: 1, _d: {} },
          'onlyExistsInStorage',
          client.socketWrapper
          )
        done()
      }, 75)
    })

    it('returns null for non existent records', () => {
      options.services.cache.nextGetWillBeSynchronous = true

      recordRequest(
        'doesNotExist',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(completeCallback).toHaveBeenCalledWith(
        null,
        'doesNotExist',
        client.socketWrapper
        )
      expect(errorCallback).not.toHaveBeenCalled()

      expect(options.services.cache.lastRequestedKey).toBe('doesNotExist')
      expect(options.services.storage.lastRequestedKey).toBe('doesNotExist')
    })

    it('handles cache errors', () => {
      options.services.cache.nextGetWillBeSynchronous = true
      options.services.cache.nextOperationWillBeSuccessful = false

      recordRequest(
        'cacheError',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(errorCallback).toHaveBeenCalledWith(
        'RECORD_LOAD_ERROR',
        'error while loading cacheError from cache:storageError',
        'cacheError',
        client.socketWrapper
        )
      expect(completeCallback).not.toHaveBeenCalled()

      expect(options.services.logger.log).toHaveBeenCalledWith(
        3, 'RECORD_LOAD_ERROR', 'error while loading cacheError from cache:storageError'
      )
      // expect(client.socketWrapper.socket.lastSendMessage).toBe(
      //   msg('R|E|RECORD_LOAD_ERROR|error while loading cacheError from cache:storageError+'
      // ))
    })

    it('handles storage errors', () => {
      options.services.cache.nextGetWillBeSynchronous = true
      options.services.cache.nextOperationWillBeSuccessful = true
      options.services.storage.nextGetWillBeSynchronous = true
      options.services.storage.nextOperationWillBeSuccessful = false

      recordRequest(
        'storageError',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(errorCallback).toHaveBeenCalledWith(
        'RECORD_LOAD_ERROR',
        'error while loading storageError from storage:storageError',
        'storageError',
        client.socketWrapper
        )
      expect(completeCallback).not.toHaveBeenCalled()

      expect(options.services.logger.log).toHaveBeenCalledWith(3, 'RECORD_LOAD_ERROR', 'error while loading storageError from storage:storageError')
      // expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_LOAD_ERROR|error while loading storageError from storage:storageError+'))
    })

    describe('handles cache timeouts', () => {
      beforeEach(() => {
        options.config.cacheRetrievalTimeout = 1
        options.services.cache.nextGetWillBeSynchronous = false
        options.services.cache.nextOperationWillBeSuccessful = true
      })

      afterEach(() => {
        options.config.cacheRetrievalTimeout = 10
      })

      it('sends a CACHE_RETRIEVAL_TIMEOUT message when cache times out', (done) => {
        recordRequest(
          'willTimeoutCache',
          options.config,
          options.services,
          client.socketWrapper,
          completeCallback,
          errorCallback,
          null
        )

        setTimeout(() => {
          expect(errorCallback).toHaveBeenCalledWith(
            'CACHE_RETRIEVAL_TIMEOUT',
            'willTimeoutCache',
            'willTimeoutCache',
            client.socketWrapper
            )
          expect(completeCallback).not.toHaveBeenCalled()

          // ignores update from cache that may occur afterwards
          options.services.cache.triggerLastGetCallback(null, '{ data: "value" }')
          expect(completeCallback).not.toHaveBeenCalled()

          done()
        }, 1)
      })
    })

    describe('handles storage timeouts', () => {
      beforeEach(() => {
        options.config.storageRetrievalTimeout = 1
        options.services.cache.nextGetWillBeSynchronous = true
        options.services.cache.nextOperationWillBeSuccessful = true
        options.services.storage.nextGetWillBeSynchronous = false
        options.services.storage.nextOperationWillBeSuccessful = true
      })

      it('sends a STORAGE_RETRIEVAL_TIMEOUT message when storage times out', (done) => {
        recordRequest(
          'willTimeoutStorage',
          options.config,
          options.services,
          client.socketWrapper,
          completeCallback,
          errorCallback,
          null
        )

        setTimeout(() => {
          expect(errorCallback).toHaveBeenCalledWith(
            'STORAGE_RETRIEVAL_TIMEOUT',
            'willTimeoutStorage',
            'willTimeoutStorage',
            client.socketWrapper
          )
          expect(completeCallback).not.toHaveBeenCalled()

          // ignores update from storage that may occur afterwards
          options.services.storage.triggerLastGetCallback(null, '{ data: "value" }')
          expect(completeCallback).not.toHaveBeenCalled()

          done()
        }, 1)
      })
    })
  })

  describe('excluded records are not put into storage', () => {
    beforeEach(() => {
      options.services.cache.nextGetWillBeSynchronous = true
      options.services.storage.nextGetWillBeSynchronous = true
      options.services.storage.delete = jasmine.createSpy('storage.delete')
      options.services.storage.set('dont-save/1', { _v: 1, _d: {} }, () => {})
    })

    it('returns null when requesting a record that doesn\'t exists in a synchronous cache, and is excluded from storage', (done) => {
      recordRequest(
        'dont-save/1',
        options.config,
        options.services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
      )

      expect(completeCallback).toHaveBeenCalledWith(
        null,
        'dont-save/1',
        client.socketWrapper
      )
      expect(errorCallback).not.toHaveBeenCalled()
      expect(options.services.storage.lastRequestedKey).toBeNull()
      done()
    })
  })
})
