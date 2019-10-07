import 'mocha'
import { expect } from 'chai'
import {spy} from 'sinon'

import * as C from '../../constants'
import { recordRequest } from './record-request'

import { getTestMocks } from '../../test/helper/test-mocks'
import { RECORD_ACTION } from '../../constants'
import * as testHelper from '../../test/helper/test-helper'
import { PromiseDelay } from '../../utils/utils';

describe('record request', () => {
  const completeCallback = spy()
  const errorCallback = spy()

  let testMocks
  let client
  let config
  let services

  const cacheData = { cache: true }
  const storageData = { storage: true }

  beforeEach(() => {
    const options = testHelper.getDeepstreamOptions()
    services = options.services
    config = Object.assign({}, options.config, {
      record: {
        cacheRetrievalTimeout: 100,
        storageRetrievalTimeout: 100,
        storageExclusionPrefixes: ['dont-save']
      }
    })
    services.cache.set('existingRecord', 1, cacheData, () => {})
    services.storage.set('onlyExistsInStorage', 1, storageData, () => {})

    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper('someUser')

    completeCallback.resetHistory()
    errorCallback.resetHistory()
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

      expect(services.cache.lastRequestedKey).to.equal('existingRecord')
      expect(services.storage.lastRequestedKey).to.equal(null)

      expect(completeCallback).to.have.been.calledWith(
        'existingRecord', 1, cacheData, client.socketWrapper
      )
      expect(errorCallback).to.have.callCount(0)
    })

    it('requests a record that exists in an asynchronous cache', async () => {
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

      await PromiseDelay(30)

      expect(completeCallback).to.have.been.calledWith(
        'existingRecord',
        1,
        cacheData,
        client.socketWrapper
        )
      expect(errorCallback).to.have.callCount(0)
      expect(services.cache.lastRequestedKey).to.equal('existingRecord')
      expect(services.storage.lastRequestedKey).to.equal(null)
    })

    it('requests a record that doesn\'t exists in a synchronous cache, but in storage', () => {
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

      expect(services.cache.lastRequestedKey).to.equal('onlyExistsInStorage')
      expect(services.storage.lastRequestedKey).to.equal('onlyExistsInStorage')

      expect(completeCallback).to.have.been.calledWith('onlyExistsInStorage', 1, storageData, client.socketWrapper)
      expect(errorCallback).to.have.callCount(0)
    })

    it('requests a record that doesn\'t exists in an asynchronous cache, but in asynchronous storage', async () => {
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

      await PromiseDelay(75)

      expect(services.cache.lastRequestedKey).to.equal('onlyExistsInStorage')
      expect(services.storage.lastRequestedKey).to.equal('onlyExistsInStorage')

      expect(errorCallback).to.have.callCount(0)
      expect(completeCallback).to.have.been.calledWith(
        'onlyExistsInStorage', 1, storageData, client.socketWrapper
      )
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

      expect(completeCallback).to.have.been.calledWith('doesNotExist', -1, null, client.socketWrapper)
      expect(errorCallback).to.have.callCount(0)

      expect(services.cache.lastRequestedKey).to.equal('doesNotExist')
      expect(services.storage.lastRequestedKey).to.equal('doesNotExist')
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

      expect(errorCallback).to.have.been.calledWith(
        RECORD_ACTION.RECORD_LOAD_ERROR,
        'error while loading cacheError from cache:storageError',
        'cacheError',
        client.socketWrapper
        )
      expect(completeCallback).to.have.callCount(0)

      expect(services.logger.logSpy).to.have.been.calledWith(
        3, RECORD_ACTION[RECORD_ACTION.RECORD_LOAD_ERROR], 'error while loading cacheError from cache:storageError'
      )
      // expect(client.socketWrapper.socket.lastSendMessage).to.equal(
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

      expect(errorCallback).to.have.been.calledWith(
        RECORD_ACTION.RECORD_LOAD_ERROR,
        'error while loading storageError from storage:storageError',
        'storageError',
        client.socketWrapper
        )
      expect(completeCallback).to.have.callCount(0)

      expect(services.logger.logSpy).to.have.been.calledWith(3, RECORD_ACTION[RECORD_ACTION.RECORD_LOAD_ERROR], 'error while loading storageError from storage:storageError')
      // expect(socketWrapper.socket.lastSendMessage).to.equal(msg('R|E|RECORD_LOAD_ERROR|error while loading storageError from storage:storageError+'))
    })

    describe('handles cache timeouts', () => {
      beforeEach(() => {
        config.record.cacheRetrievalTimeout = 1
        services.cache.nextGetWillBeSynchronous = false
        services.cache.nextOperationWillBeSuccessful = true
      })

      afterEach(() => {
        config.cacheRetrievalTimeout = 10
      })

      it('sends a CACHE_RETRIEVAL_TIMEOUT message when cache times out', (done) => {
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
          expect(errorCallback).to.have.been.calledWith(
            C.RECORD_ACTION.CACHE_RETRIEVAL_TIMEOUT,
            'willTimeoutCache',
            'willTimeoutCache',
            client.socketWrapper
          )
          expect(completeCallback).to.have.callCount(0)

          // ignores update from cache that may occur afterwards
          services.cache.triggerLastGetCallback(null, '{ data: "value" }')
          expect(completeCallback).to.have.callCount(0)

          done()
        }, 1)
      })
    })

    describe('handles storage timeouts', () => {
      beforeEach(() => {
        config.record.storageRetrievalTimeout = 1
        services.cache.nextGetWillBeSynchronous = true
        services.cache.nextOperationWillBeSuccessful = true
        services.storage.nextGetWillBeSynchronous = false
        services.storage.nextOperationWillBeSuccessful = true
      })

      it('sends a STORAGE_RETRIEVAL_TIMEOUT message when storage times out', async () => {
        recordRequest(
          'willTimeoutStorage',
          config,
          services,
          client.socketWrapper,
          completeCallback,
          errorCallback,
          null
        )

        await PromiseDelay(1)

        expect(errorCallback).to.have.been.calledWith(
          C.RECORD_ACTION.STORAGE_RETRIEVAL_TIMEOUT,
          'willTimeoutStorage',
          'willTimeoutStorage',
          client.socketWrapper
        )
        expect(completeCallback).to.have.callCount(0)

        // ignores update from storage that may occur afterwards
        services.storage.triggerLastGetCallback(null, '{ data: "value" }')
        expect(completeCallback).to.have.callCount(0)
      })
    })
  })

  describe('excluded records are not put into storage', () => {
    beforeEach(() => {
      services.cache.nextGetWillBeSynchronous = true
      services.storage.nextGetWillBeSynchronous = true
      services.storage.delete = spy()
      services.storage.set('dont-save/1', 1, {}, () => {})
    })

    it('returns null when requesting a record that doesn\'t exists in a synchronous cache, and is excluded from storage', () => {
      recordRequest(
        'dont-save/1',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        null
      )

      expect(completeCallback).to.have.been.calledWith(
        'dont-save/1',
        -1,
        null,
        client.socketWrapper
      )
      expect(errorCallback).to.have.callCount(0)
      expect(services.storage.lastRequestedKey).to.equal(null)
    })
  })

  describe('promoting to cache can be disabled', () => {
    beforeEach(() => {
      services.cache.nextGetWillBeSynchronous = true
      services.storage.nextGetWillBeSynchronous = true
      services.cache.set = spy()
      services.storage.set('dont-save/1', 1, {}, () => {})
    })

    it('doesnt call set on cache if promoteToCache is disabled', () => {
      recordRequest(
        'onlyExistsInStorage',
        config,
        services,
        client.socketWrapper,
        completeCallback,
        errorCallback,
        this,
        null,
        null,
        false
      )

      expect(completeCallback).to.have.been.calledWith(
        'onlyExistsInStorage',
        1,
        { storage: true },
        client.socketWrapper
      )
      expect(services.cache.set).to.have.callCount(0)

      expect(errorCallback).to.have.callCount(0)
      expect(services.cache.lastRequestedKey).to.equal('onlyExistsInStorage')
      expect(services.storage.lastRequestedKey).to.equal('onlyExistsInStorage')
    })
  })
})
