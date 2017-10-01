/* eslint-disable prefer-rest-params */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

class AuthenticationHandlerMock {

  constructor () {
    this.reset()
  }

  reset () {
    this.nextUserIsAnonymous = false
    this.nextUserValidationResult = true
    this.lastUserValidationQueryArgs = null
    this.sendNextValidAuthWithData = false
    this.onClientDisconnectCalledWith = null
  }

  isValidUser (handshakeData, authData, callback) {
    this.lastUserValidationQueryArgs = arguments
    if (this.nextUserValidationResult === true) {
      if (this.sendNextValidAuthWithData === true) {
        callback(true, {
          username: 'test-user',
          clientData: 'test-data'
        })
      } else if (this.nextUserIsAnonymous) {
        callback(true, {})
      } else {
        callback(true, { username: 'test-user' })
      }
    } else {
      callback(false, { clientData: 'Invalid User' })
    }
  }

  onClientDisconnect (username) {
    this.onClientDisconnectCalledWith = username
  }
}

module.exports = new AuthenticationHandlerMock()
