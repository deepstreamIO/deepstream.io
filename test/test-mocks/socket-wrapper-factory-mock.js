'use strict'

const EventEmitter = require('events').EventEmitter

class SocketWrapperMock extends EventEmitter {
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
    SocketWrapperMock.lastPreparedMessage = message
    return message
  }

  sendPrepared (/* preparedMessage */) {
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

  sendError (/* topic, type, msg */) {
  }

  sendMessage (message) {
    this.lastSendMessage = message
  }

  parseData (message) {
    if (message.parsedData || !message.data) {
      return
    }
    try {
      message.parsedData = JSON.parse(message.data)
      return true
    } catch (e) {
      return e
    }
  }

  send (/* message */) {
  }

  destroy () {
    this.authCallBack = null
    this.isClosed = true
    this.emit('close', this)
  }

  close () {
    this.destroy()
  }

  _setUpHandshakeData () {
    this._handshakeData = {
      remoteAddress: 'remote@address'
    }

    return this._handshakeData
  }
}

module.exports.createSocketWrapper = options => new SocketWrapperMock(options)
