'use strict'

const EventEmitter = require('events').EventEmitter
const util = require('util')

const PluginMock = function (options, name) {
  this.isReady = false
  this.description = name || 'mock-plugin'
  this.options = options
}

util.inherits(PluginMock, EventEmitter)

PluginMock.prototype.setReady = function () {
  this.isReady = true
  this.emit('ready')
}

module.exports = PluginMock
