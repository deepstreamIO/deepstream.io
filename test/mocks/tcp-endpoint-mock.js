/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const EventEmitter = require('events').EventEmitter
const util = require('util')

const TcpEndpointMock = function () {
  this.isClosed = false
}

util.inherits(TcpEndpointMock, EventEmitter)

TcpEndpointMock.prototype.close = function () {
  setTimeout(() => {
    this.isClosed = true
    this.emit('close')
  }, 1)
}

module.exports = TcpEndpointMock
