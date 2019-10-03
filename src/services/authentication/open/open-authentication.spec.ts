import 'mocha'
import { expect } from 'chai'
import { spy } from 'sinon'

import { OpenAuthentication } from './open-authentication'

describe('open authentication handler', () => {
  let authenticationHandler

  it('creates the handler', () => {
    authenticationHandler = new OpenAuthentication()
    expect(typeof authenticationHandler.isValidUser).to.equal('function')
    expect(authenticationHandler.description).to.equal('Open Authentication')
  })

  it('permissions users without auth data', async () => {
    const result = await authenticationHandler.isValidUser(null, {})
    expect(result.isValid).to.equal(true)
    expect(result.id).to.equal('open')
  })

  it('permissions users with a username', async () => {
    const result = await authenticationHandler.isValidUser(null, { username: 'Wolfram' })
    expect(result.isValid).to.equal(true)
    expect(result.id).to.equal('Wolfram')
  })
})
