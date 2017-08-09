/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const PermissionHandlerMock = function (options) {
  this.options = options
  this.isReady = true
}

PermissionHandlerMock.prototype.canPerformAction = function (username, message, callback) {
  callback(null, true)
}

module.exports = PermissionHandlerMock
