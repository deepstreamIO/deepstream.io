/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let EventEmitter = require('events').EventEmitter,
  util = require('util')

const PluginMock = function (name) {
  this.isReady = false
  this.name = name
}

util.inherits(PluginMock, EventEmitter)

PluginMock.prototype.setReady = function () {
  this.isReady = true
  this.emit('ready')
}

module.exports = PluginMock
