/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const SocketMock = function () {
  this.lastSendMessage = null
  this.isDisconnected = false
  this.sendMessages = []
  this.autoClose = true
  this.readyState = ''
  this._socket = {}
}

require('util').inherits(SocketMock, require('events').EventEmitter)

SocketMock.prototype.send = function (message) {
  this.lastSendMessage = message
  this.sendMessages.push(message)
}

SocketMock.prototype.getMsg = function (i) {
  return this.sendMessages[this.sendMessages.length - (i + 1)]
}

SocketMock.prototype.getMsgSize = function (i) {
  return this.sendMessages.length
}

SocketMock.prototype.close = function () {
  if (this.autoClose === true) {
    this.doClose()
  }
}

SocketMock.prototype.doClose = function () {
  this.isDisconnected = true
  this.readyState = 'closed'
  this.emit('close')
}

module.exports = SocketMock
