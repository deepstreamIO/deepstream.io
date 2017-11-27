import * as C from '../../src/constants'
const recordRequest = require('../../src/record/record-request').default

import { getTestMocks } from '../test-helper/test-mocks'
const testHelper = require('../test-helper/test-helper')

describe('record request', () => {
  const completeCallback = jasmine.createSpy('completeCallback')
  const errorCallback = jasmine.createSpy('errorCallback')

  let testMocks
  let client
  let config
  let services

  beforeEach(() => {
    const options = testHelper.getDeepstreamOptions()
    services = options.services
    config = Object.assign({}, options.config, {
      cacheRetrievalTimeout: 100,
      storageRetrievalTimeout: 100,
      storageExclusion: new RegExp('dont-save')
    })
    services.cache.set('existingRecord', 1, {}, () => {})
    services.storage.set('onlyExistsInStorage', 1, {}, () => {})

    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper('someUser')

    completeCallback.calls.reset()
    errorCallback.calls.reset()
  })

  describe('records are requested from cache and storage sequentially', () => {
    it('requests a record that exists in a synchronous cache', () => {
      services.cache.nextOperationWillBeSynchronous = true

      recordRequest(
        'existingRecord',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
      )

      expect(services.cache.lastRequestedKey).toBe('existingRecord')
      expect(services.storage.lastRequestedKey).toBe(null)

      expect(completeCallback).toHaveBeenCalledWith(
        'existingRecord', 1, {}, client.socketWrapper
      )
      expect(errorCallback).not.toHaveBeenCalled()
    })

    it('requests a record that exists in an asynchronous cache', done => {
      services.cache.nextGetWillBeSynchronous = false

      recordRequest(
        'existingRecord',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      setTimeout(() => {
        expect(completeCallback).toHaveBeenCalledWith(
          'existingRecord',
          1,
          {},
          client.socketWrapper
          )
        expect(errorCallback).not.toHaveBeenCalled()
        expect(services.cache.lastRequestedKey).toBe('existingRecord')
        expect(services.storage.lastRequestedKey).toBe(null)
        done()
      }, 30)
    })

    xit('requests a record that doesn\'t exists in a synchronous cache, but in storage', () => {
      services.cache.nextGetWillBeSynchronous = true

      recordRequest(
        'onlyExistsInStorage',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(services.cache.lastRequestedKey).toBe('onlyExistsInStorage')
      expect(services.storage.lastRequestedKey).toBe('onlyExistsInStorage')

      expect(completeCallback).toHaveBeenCalledWith('onlyExistsInStorage', 1, {}, client.socketWrapper)
      expect(errorCallback).not.toHaveBeenCalled()
    })

    xit('requests a record that doesn\'t exists in an asynchronous cache, but in asynchronous storage', done => {
      services.cache.nextGetWillBeSynchronous = false
      services.storage.nextGetWillBeSynchronous = false

      recordRequest(
        'onlyExistsInStorage',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      setTimeout(() => {
        expect(services.cache.lastRequestedKey).toBe('onlyExistsInStorage')
        expect(services.storage.lastRequestedKey).toBe('onlyExistsInStorage')

        expect(errorCallback).not.toHaveBeenCalled()
        expect(completeCallback).toHaveBeenCalledWith(
          'onlyExistsInStorage', 1, {}, client.socketWrapper
        )
        done()
      }, 75)
    })

    it('returns null for non existent records', () => {
      services.cache.nextGetWillBeSynchronous = true

      recordRequest(
        'doesNotExist',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(completeCallback).toHaveBeenCalledWith('doesNotExist', -1, null, client.socketWrapper)
      expect(errorCallback).not.toHaveBeenCalled()

      expect(services.cache.lastRequestedKey).toBe('doesNotExist')
      expect(services.storage.lastRequestedKey).toBe('doesNotExist')
    })

    it('handles cache errors', () => {
      services.cache.nextGetWillBeSynchronous = true
      services.cache.nextOperationWillBeSuccessful = false

      recordRequest(
        'cacheError',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(errorCallback).toHaveBeenCalledWith(
        C.RECORD_ACTIONS.RECORD_LOAD_ERROR,
        'error while loading cacheError from cache:storageError',
        'cacheError',
        client.socketWrapper
        )
      expect(completeCallback).not.toHaveBeenCalled()

      expect(services.logger._log).toHaveBeenCalledWith(
        3, C.RECORD_ACTIONS.RECORD_LOAD_ERROR, 'error while loading cacheError from cache:storageError'
      )
      // expect(client.socketWrapper.socket.lastSendMessage).toBe(
      //   msg('R|E|RECORD_LOAD_ERROR|error while loading cacheError from cache:storageError+'
      // ))
    })

    it('handles storage errors', () => {
      services.cache.nextGetWillBeSynchronous = true
      services.cache.nextOperationWillBeSuccessful = true
      services.storage.nextGetWillBeSynchronous = true
      services.storage.nextOperationWillBeSuccessful = false

      recordRequest(
        'storageError',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
        )

      expect(errorCallback).toHaveBeenCalledWith(
        C.RECORD_ACTIONS.RECORD_LOAD_ERROR,
        'error while loading storageError from storage:storageError',
        'storageError',
        client.socketWrapper
        )
      expect(completeCallback).not.toHaveBeenCalled()

      expect(services.logger._log).toHaveBeenCalledWith(3, C.RECORD_ACTIONS.RECORD_LOAD_ERROR, 'error while loading storageError from storage:storageError')
      // expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|RECORD_LOAD_ERROR|error while loading storageError from storage:storageError+'))
    })

    describe('handles cache timeouts', () => {
      beforeEach(() => {
        config.cacheRetrievalTimeout = 1
        services.cache.nextGetWillBeSynchronous = false
        services.cache.nextOperationWillBeSuccessful = true
      })

      afterEach(() => {
        config.cacheRetrievalTimeout = 10
      })

      it('sends a CACHE_RETRIEVAL_TIMEOUT message when cache times out', done => {
        recordRequest(
          'willTimeoutCache',
          config,
          services,
          client.socketWrapper,
          completeCallback,
          errorCallback,
          null
        )

        setTimeout(() => {
          expect(errorCallback).toHaveBeenCalledWith(
            C.RECORD_ACTIONS.CACHE_RETRIEVAL_TIMEOUT,
            'willTimeoutCache',
            'willTimeoutCache',
            client.socketWrapper
            )
          expect(completeCallback).not.toHaveBeenCalled()

          // ignores update from cache that may occur afterwards
          services.cache.triggerLastGetCallback(null, '{ data: "value" }')
          expect(completeCallback).not.toHaveBeenCalled()

          done()
        }, 1)
      })
    })

    describe('handles storage timeouts', () => {
      beforeEach(() => {
        config.storageRetrievalTimeout = 1
        services.cache.nextGetWillBeSynchronous = true
        services.cache.nextOperationWillBeSuccessful = true
        services.storage.nextGetWillBeSynchronous = false
        services.storage.nextOperationWillBeSuccessful = true
      })

      it('sends a STORAGE_RETRIEVAL_TIMEOUT message when storage times out', done => {
        recordRequest(
          'willTimeoutStorage',
          config,
          services,
          client.socketWrapper,
          completeCallback,
          errorCallback,
          null
        )

        setTimeout(() => {
          expect(errorCallback).toHaveBeenCalledWith(
            C.RECORD_ACTIONS.STORAGE_RETRIEVAL_TIMEOUT,
            'willTimeoutStorage',
            'willTimeoutStorage',
            client.socketWrapper
          )
          expect(completeCallback).not.toHaveBeenCalled()

          // ignores update from storage that may occur afterwards
          services.storage.triggerLastGetCallback(null, '{ data: "value" }')
          expect(completeCallback).not.toHaveBeenCalled()

          done()
        }, 1)
      })
    })
  })

  describe('excluded records are not put into storage', () => {
    beforeEach(() => {
      services.cache.nextGetWillBeSynchronous = true
      services.storage.nextGetWillBeSynchronous = true
      services.storage.delete = jasmine.createSpy('storage.delete')
      services.storage.set('dont-save/1', 1, {}, () => {})
    })

    it('returns null when requesting a record that doesn\'t exists in a synchronous cache, and is excluded from storage', done => {
      recordRequest(
        'dont-save/1',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
      )

      expect(completeCallback).toHaveBeenCalledWith(
        'dont-save/1',
        -1,
        null,
        client.socketWrapper
      )
      expect(errorCallback).not.toHaveBeenCalled()
      expect(services.storage.lastRequestedKey).toBeNull()
      done()
    })
  })
})
