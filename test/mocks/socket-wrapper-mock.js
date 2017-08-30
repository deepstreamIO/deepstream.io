'use strict'

const C = require('../../src/constants/constants')
const messageBuilder = require('../../src/message/message-builder')
const utils = require('util')
const SocketMock = require('./socket-mock')

const EventEmitter = require('events').EventEmitter

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 *
 * @param {WebSocket} socket
 * @param {Object} options
 *
 * @extends EventEmitter
 *
 * @constructor
 */
const SocketWrapper = function (socket, options) {
  this.socket = socket
  if (!this.socket.on) {
    this.socket = new SocketMock()
  }
  this.isClosed = false
  this.socket.once('close', this._onSocketClose.bind(this))
  this.user = null
  this.authCallBack = null
  this.authAttempts = 0
  this.setMaxListeners(0)
  this.uuid = Math.random()
  this._handshakeData = options

  this._queuedMessages = []
  this._currentPacketMessageCount = 0
  this._sendNextPacketTimeout = null
  this._currentMessageResetTimeout = null
}

utils.inherits(SocketWrapper, EventEmitter)
SocketWrapper.lastPreparedMessage = null

/**
 * Updates lastPreparedMessage and returns the [uws] prepared message.
 *
 * @param {String} message the message to be prepared
 *
 * @public
 * @returns {External} prepared message
 */
SocketWrapper.prototype.prepareMessage = function (message) {
  SocketWrapper.lastPreparedMessage = message
  return message
}

/**
 * Sends the [uws] prepared message, or in case of testing sends the
 * last prepared message.
 *
 * @param {External} preparedMessage the prepared message
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendPrepared = function (preparedMessage) {
  this.socket.send(preparedMessage)
}

/**
 * Finalizes the [uws] perpared message.
 *
 * @param {External} preparedMessage the prepared message to finalize
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.finalizeMessage = function () {
}

/**
 * Variant of send with no particular checks or appends of message.
 *
 * @param {String} message the message to send
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendNative = function (message) {
  this.socket.send(message)
}

/**
 * Returns a map of parameters that were collected
 * during the initial http request that established the
 * connection
 *
 * @public
 * @returns {Object} handshakeData
 */
SocketWrapper.prototype.getHandshakeData = function () {
  return this._handshakeData
}

/**
 * Sends an error on the specified topic. The
 * action will automatically be set to C.ACTION.ERROR
 *
 * @param {String} topic one of C.TOPIC
 * @param {String} type one of C.EVENT
 * @param {String} msg generic error message
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendError = function (topic, type, msg) {
  if (this.isClosed === false) {
    this.send(messageBuilder.getErrorMsg(topic, type, msg))
  }
}

/**
 * Sends a message based on the provided action and topic
 *
 * @param {String} topic one of C.TOPIC
 * @param {String} action one of C.ACTIONS
 * @param {Array} data Array of strings or JSON-serializable objects
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.sendMessage = function (topic, action, data) {
  if (this.isClosed === false) {
    this.send(messageBuilder.getMsg(topic, action, data))
  }
}

/**
 * Checks the passed message and appends missing end separator if
 * needed, and then sends this message immediately.
 *
 * @param   {String} message deepstream message
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.send = function (message) {
  this.lastSendMessage = message
  if (message.charAt(message.length - 1) !== C.MESSAGE_SEPERATOR) {
    message += C.MESSAGE_SEPERATOR // eslint-disable-line
  }

  if (this.isClosed === true) {
    return
  }

  this.socket.send(message)
}

/**
 * Destroyes the socket. Removes all deepstream specific
 * logic and closes the connection
 *
 * @public
 * @returns {void}
 */
SocketWrapper.prototype.destroy = function () {
  this.socket.close()
  this.authCallBack = null
}

/**
 * Callback for closed sockets
 *
 * @private
 * @returns {void}
 */
SocketWrapper.prototype._onSocketClose = function () {
  this.isClosed = true
  this.emit('close', this)
  this.socket.removeAllListeners()
}

/**
 * Initialise the handshake data from the initial connection
 *
 * @private
 * @returns void
 */
SocketWrapper.prototype._setUpHandshakeData = function () {
  this._handshakeData = {
    remoteAddress: 'remote@address'
  }

  return this._handshakeData
}

module.exports = SocketWrapper
