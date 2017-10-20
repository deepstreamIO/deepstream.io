/* eslint-disable prefer-rest-params */
'use strict'

const PermissionHandlerMock = function (options /* , services */) {
  this.isReady = true
  this.options = options
  this.reset()
}

PermissionHandlerMock.prototype.reset = function () {
  this.nextCanPerformActionResult = true
  this.lastCanPerformActionQueryArgs = null
}

PermissionHandlerMock.prototype.canPerformAction = function (username, message, callback) {
  this.lastCanPerformActionQueryArgs = arguments
  if (typeof this.nextCanPerformActionResult === 'string') {
    callback(this.nextCanPerformActionResult)
  } else {
    callback(null, this.nextCanPerformActionResult)
  }
}

module.exports = PermissionHandlerMock
