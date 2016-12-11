/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const SocketMock = require('./socket-mock')

let i = 0
let websocketMock = null

const WebsocketMock = function () {
  this.clients = {}
  this.clientsCount = 0
  this.pingInterval = null
  this.pingMessage = null
  this.setMaxListeners(0)
  websocketMock = this
}

require('util').inherits(WebsocketMock, require('events').EventEmitter)

WebsocketMock.prototype.simulateConnection = function () {
  const socketMock = new SocketMock()
  const clientIndex = i++
  socketMock.once('close', this._onClose.bind(this, clientIndex))
  this.clients[clientIndex] = socketMock
  this.clientsCount++
  this.emit('connection', socketMock)
  return socketMock
}

WebsocketMock.prototype.startAutoPing = function (interval, message) {
  this.pingInterval = interval
  this.pingMessage = message
}

WebsocketMock.prototype.Server = function () {
  return websocketMock
}

WebsocketMock.prototype._onClose = function (clientIndex) {
  delete this.clients[clientIndex]
  this.clientsCount--
}

WebsocketMock.prototype.close = function () {
  for (const clientIndex in this.clients) {
    this.clients[clientIndex].close()
  }
}

module.exports = new WebsocketMock()
