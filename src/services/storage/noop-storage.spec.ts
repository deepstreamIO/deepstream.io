import 'mocha'
import { expect } from 'chai'
import {spy} from 'sinon'
import { NoopStorage } from './noop-storage'

describe('retuns null for all values', () => {
  let noopStorage

  before(() => {
    noopStorage = new NoopStorage()
  })

  it('has created the Noop Storage', async () => {
    await noopStorage.whenReady()
  })

  it('tries to retrieve a non-existing value', (done) => {
    const successCallback = spy()
    noopStorage.get('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback).to.have.callCount(1)
      expect(successCallback).to.have.been.calledWith(null, -1, null)
      done()
    }, 1)
  })

  it('tries to delete a value', (done) => {
    const successCallback = spy()
    noopStorage.delete('firstname', successCallback)
    setTimeout(() => {
      expect(successCallback).to.have.callCount(1)
      expect(successCallback).to.have.been.calledWith(null)
      done()
    }, 1)
  })
})
