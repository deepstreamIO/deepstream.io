import LocalCache from '../../src/default-plugins/local-cache'

describe('it saves values in memory', () => {
  let localCache

  beforeAll(() => {
    localCache = new LocalCache()
  })

  it('has created the local cache', () => {
    expect(localCache.isReady).toBe(true)
  })

  it('sets a value in the cache', done => {
    const successCallback = jasmine.createSpy('set success')
    localCache.set('firstname', 1, 'Wolfram', successCallback)
    setTimeout(() => {
      expect(successCallback.calls.count()).toBe(1)
      expect(successCallback.calls.mostRecent().args).toEqual([null])
      done()
    }, 1)
  })

  it('retrieves an existing value from the cache', done => {
    const successCallback = jasmine.createSpy('set success')
    localCache.get('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback.calls.count()).toBe(1)
      expect(successCallback.calls.mostRecent().args).toEqual([null, 1, 'Wolfram'])
      done()
    }, 1)
  })

  it('deletes a value from the cache', done => {
    const successCallback = jasmine.createSpy('set success')
    localCache.delete('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback.calls.count()).toBe(1)
      expect(successCallback.calls.mostRecent().args).toEqual([null])
      done()
    }, 1)
  })

  it('tries to retrieve a non-existing value from the cache', done => {
    const successCallback = jasmine.createSpy('set success')
    localCache.get('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback.calls.count()).toBe(1)
      expect(successCallback.calls.mostRecent().args).toEqual([null, -1, null])
      done()
    }, 1)
  })
})
