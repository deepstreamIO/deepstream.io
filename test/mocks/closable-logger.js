/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const events = require('events')
const utils = require('util')

const ClosableLogger = function () {
  this.isReady = false
  setTimeout(this._setReady.bind(this), 1)
}

utils.inherits(ClosableLogger, events.EventEmitter)

ClosableLogger.prototype.log = jasmine.createSpy('log')
ClosableLogger.prototype.setLogLevel = function () {}

ClosableLogger.prototype.close = function () {
  setTimeout(this._setClosed.bind(this), 1)
}


ClosableLogger.prototype._setReady = function () {
  this.isReady = true
  this.emit('ready')
}

ClosableLogger.prototype._setClosed = function () {
  this.isReady = false
  this.emit('close')
}

module.exports = ClosableLogger
