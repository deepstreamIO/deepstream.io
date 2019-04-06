import 'mocha'
import { expect } from 'chai'
import { spy } from 'sinon'

import AuthenticationHandler from './open-authentication-handler'

describe('open authentication handler', () => {
  let authenticationHandler

  it('creates the handler', () => {
    authenticationHandler = new AuthenticationHandler()
    expect(typeof authenticationHandler.isValidUser).to.equal('function')
    expect(authenticationHandler.description).to.equal('none')
  })

  it('permissions users without auth data', () => {
    const callback = spy()
    authenticationHandler.isValidUser(null, {}, callback)
    expect(callback).to.have.been.calledWith(true, { username: 'open' })
  })

  it('permissions users with a username', () => {
    const callback = spy()
    authenticationHandler.isValidUser(null, { username: 'Wolfram' }, callback)
    expect(callback).to.have.been.calledWith(true, { username: 'Wolfram' })
  })
})
