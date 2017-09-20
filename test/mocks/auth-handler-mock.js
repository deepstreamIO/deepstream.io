/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const AuthenticationHandlerMock = function (options) {
  this.options = options
  this.isReady = true
}

AuthenticationHandlerMock.prototype.isValidUser = function (handshakeData, authData, callback) {
  callback(true, { username: authData.username, clientData: { favouriteColour: 'blue' } })
}

module.exports = AuthenticationHandlerMock
