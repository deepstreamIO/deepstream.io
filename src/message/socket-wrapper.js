'use strict'

const C = require('../constants/constants')
const messageBuilder = require('./message-builder')
const utils = require('util')
const uws = require('uws')

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
class SocketWrapper extends EventEmitter {

  constructor (external, options) {
    super()
    this.isClosed = false
    this._options = options
    this.user = null
    this.authCallBack = null
    this.authAttempts = 0
    this.setMaxListeners(0)
    this.uuid = Math.random()
    this._handshakeData = null
    this._external = external

    this._queuedMessages = []
    this._currentPacketMessageCount = 0
    this._sendNextPacketTimeout = null
    this._currentMessageResetTimeout = null
  }

  /**
   * Updates lastPreparedMessage and returns the [uws] prepared message.
   *
   * @param {String} message the message to be prepared
   *
   * @public
   * @returns {External} prepared message
   */
  static prepareMessage (message) {
    SocketWrapper.lastPreparedMessage = message
    return uws.native.server.prepareMessage(message, uws.OPCODE_TEXT)
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
  sendPrepared (preparedMessage) {
    uws.native.server.sendPrepared(this._external, preparedMessage)
  }

  /**
   * Variant of send with no particular checks or appends of message.
   *
   * @param {String} message the message to send
   *
   * @public
   * @returns {void}
   */
  sendNative (message) {
    uws.native.server.send(this._external, message)
  }

  /**
   * Finalizes the [uws] perpared message.
   *
   * @param {External} preparedMessage the prepared message to finalize
   *
   * @public
   * @returns {void}
   */
  static finalizeMessage (preparedMessage) {
    uws.native.server.finalizeMessage(preparedMessage)
  }

  /**
   * Returns a map of parameters that were collected
   * during the initial http request that established the
   * connection
   *
   * @public
   * @returns {Object} handshakeData
   */
  getHandshakeData () {
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
  sendError (topic, type, msg) {
    if (this.isClosed === false) {
      this.send(messageBuilder.getErrorMsg(topic, type, msg))
    }
  }

  onMessage () {
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
  sendMessage (topic, action, data) {
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
  send (message) {
    if (message.charAt(message.length - 1) !== C.MESSAGE_SEPERATOR) {
      message += C.MESSAGE_SEPERATOR // eslint-disable-line
    }

    if (this.isClosed === true) {
      return
    }
    uws.native.server.send(this._external, message, uws.OPCODE_TEXT)
  }

  /**
   * Destroyes the socket. Removes all deepstream specific
   * logic and closes the connection
   *
   * @public
   * @returns {void}
   */
  destroy () {
    uws.native.server.terminate(this._external)
  }

  close () {
    this.isClosed = true
    delete this.authCallBack
    this.emit('close', this)
    this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.CLIENT_DISCONNECTED, this.user)
    this.removeAllListeners()
  }

  /**
   * Initialise the handshake data from the initial connection
   *
   * @private
   * @returns void
   */
  setHandshakeData (data) {
    this._handshakeData = data
  }
}

SocketWrapper.lastPreparedMessage = null
module.exports = SocketWrapper
