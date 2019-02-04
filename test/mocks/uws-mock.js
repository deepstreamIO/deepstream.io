/* eslint-disable class-methods-use-this, no-unused-vars */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const SocketMock = require('./socket-mock')

class Server {
  constructor (root) {
    this.root = root
    this.group = new Group(root)
  }

  send () {
  }
}

class Native {
  constructor (root) {
  }
}

let i = 0
let uwsMock = null

const UWSMock = function () {
  this.clients = {}
  this.clientsCount = 0
  this.heartbeatInterval = null
  this.pingMessage = null
  this._connectionHandler = null
  this._messageHandler = null
  this.setMaxListeners(0)
  uwsMock = this
  this.native = new Native(this)
  // this.on('message', )
}

require('util').inherits(UWSMock, require('events').EventEmitter)

UWSMock.prototype.simulateConnection = function () {
  const socketMock = this._lastUserData

  const clientIndex = i++
  socketMock.once('close', this._onClose.bind(this, clientIndex))
  this.clients[clientIndex] = socketMock
  this.clientsCount++

  return socketMock
}

UWSMock.prototype._onClose = function (clientIndex) {
  delete this.clients[clientIndex]
  this.clientsCount--
}

UWSMock.prototype.close = function () {
  for (const clientIndex in this.clients) {
    this.clients[clientIndex].socket.close()
  }
}

module.exports = new UWSMock()
