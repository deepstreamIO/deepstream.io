/* global jasmine, describe, it, expect */
'use strict'

const AuthenticationHandler = require('../../src/authentication/open-authentication-handler')

describe('open authentication handler', () => {
  let authenticationHandler

  it('creates the handler', () => {
    authenticationHandler = new AuthenticationHandler()
    expect(typeof authenticationHandler.isValidUser).toBe('function')
    expect(authenticationHandler.type).toBe('none')
  })

  it('permissions users without auth data', () => {
    const callback = jasmine.createSpy('callback')
    authenticationHandler.isValidUser(null, {}, callback)
    expect(callback).toHaveBeenCalledWith(true, { username: 'open' })
  })

  it('permissions users with a username', () => {
    const callback = jasmine.createSpy('callback')
    authenticationHandler.isValidUser(null, { username: 'Wolfram' }, callback)
    expect(callback).toHaveBeenCalledWith(true, { username: 'Wolfram' })
  })
})
