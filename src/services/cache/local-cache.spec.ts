import 'mocha'
import { expect } from 'chai'
import {spy} from 'sinon'
import { LocalCache } from './local-cache'

describe('it saves values in memory', () => {
  let localCache

  before(() => {
    localCache = new LocalCache()
  })

  it('has created the Local Cache', async () => {
    await localCache.whenReady()
  })

  it('sets a value in the cache', (done) => {
    const successCallback = spy()
    localCache.set('firstname', 1, 'Wolfram', successCallback)
    setTimeout(() => {
      expect(successCallback).to.have.callCount(1)
      expect(successCallback).to.have.been.calledWith(null)
      done()
    }, 1)
  })

  it('retrieves an existing value from the cache', (done) => {
    const successCallback = spy()
    localCache.get('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback).to.have.callCount(1)
      expect(successCallback).to.have.been.calledWith(null, 1, 'Wolfram')
      done()
    }, 1)
  })

  it('deletes a value from the cache', (done) => {
    const successCallback = spy()
    localCache.delete('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback).to.have.callCount(1)
      expect(successCallback).to.have.been.calledWith(null)
      done()
    }, 1)
  })

  it('tries to retrieve a non-existing value from the cache', (done) => {
    const successCallback = spy()
    localCache.get('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback).to.have.callCount(1)
      expect(successCallback).to.have.been.calledWith(null, -1, null)
      done()
    }, 1)
  })
})
