/* eslint-disable */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const EventEmitter = require('events').EventEmitter
const util = require('util')

const HttpServerMock = function () {
  EventEmitter.call(this)
  this.listening = false
  this.closed = false
}

util.inherits(HttpServerMock, EventEmitter)

HttpServerMock.prototype.listen = function (port, host, callback) {
  this._port = port
  this._host = host
  const server = this
  process.nextTick(() => {
    server.listening = true
    server.emit('listening')
    callback && callback()
  })
}

HttpServerMock.prototype.close = function (callback) {
  this.closed = true
  this.emit('close')
  callback && callback()
}

HttpServerMock.prototype.address = function () {
  return {
    address: this._host,
    port: this._port
  }
}

HttpServerMock.prototype._simulateUpgrade = function (socket) {
  const head = {}
  const request = {
    url: 'https://deepstream.io/?ds=foo',
    headers: {
      origin: '',
      'sec-websocket-key': 'xxxxxxxxxxxxxxxxxxxxxxxx'
    },
    connection: {
      authorized: true
    }
  }
  this.emit('upgrade', request, socket, head)
}

const HttpMock = function () {
  this.nextServerIsListening = false
}

HttpMock.prototype.createServer = function () {
  const server = new HttpServerMock()
  server.listening = this.nextServerIsListening
  return server
}

module.exports = HttpMock
