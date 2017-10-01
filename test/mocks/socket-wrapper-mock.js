'use strict'

const C = require('../../src/constants/constants')
const utils = require('util')
const EventEmitter = require('events').EventEmitter

module.exports = class SocketWrapperMock extends EventEmitter {
  constructor (options) {
    super()
    this.isClosed = false
    this.user = null
    this.authCallBack = null
    this.authAttempts = 0
    this.uuid = Math.random()
    this._handshakeData = options
  }

  prepareMessage (message) {
    SocketWrapper.lastPreparedMessage = message
    return message
  }

  sendPrepared (preparedMessage) {
  }

  finalizeMessage () {
  }

  sendNative (message) {
    this.lastSendMessage = message
  }

  sendAckMessage (message) {
    this.lastSendMessage = message
  }

  getHandshakeData () {
    return this._handshakeData
  }

  sendError (topic, type, msg) {
  }

  sendMessage (message) {
    this.lastSendMessage = message
  }

  parseMessage (message) {
    return message
  }

  send (message) {
  }

  destroy () {
    this.authCallBack = null
    this.isClosed = true
    this.emit('close', this)
  }

  close () {

  }

  _setUpHandshakeData () {
    this._handshakeData = {
      remoteAddress: 'remote@address'
    }

    return this._handshakeData
  }
}
