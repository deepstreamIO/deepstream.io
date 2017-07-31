'use strict'

const C = require('../constants/constants')
const messageBuilder = require('./message-builder')
const uws = require('uws')

const EventEmitter = require('events').EventEmitter

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 *
 * @param {WebSocket} external        uws native websocket
 * @param {Object} handshakeData      headers from the websocket http handshake
 * @param {Logger} logger
 * @param {Object} config             configuration options
 * @param {Object} connectionEndpoint the uws connection endpoint
 *
 * @extends EventEmitter
 *
 * @constructor
 */
class UwsSocketWrapper extends EventEmitter {

  constructor (external, handshakeData, logger, config, connectionEndpoint) {
    super()
    this.isClosed = false
    this._logger = logger
    this.user = null
    this.authCallBack = null
    this.authAttempts = 0
    this.setMaxListeners(0)
    this._handshakeData = handshakeData
    this._external = external

    this._config = config
    this._connectionEndpoint = connectionEndpoint
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
    if (this.isClosed) {
      return
    }
    uws.native.server.send(this._external, message, uws.OPCODE_TEXT)
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
    if (this.isClosed) {
      return
    }
    uws.native.server.sendPrepared(this._external, preparedMessage)
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
    if (this.isClosed) {
      return
    }
    this.sendNative(messageBuilder.getErrorMsg(topic, type, msg))
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
    if (this.isClosed) {
      return
    }
    this.sendNative(messageBuilder.getMsg(topic, action, data))
  }

  // eslint-disable-next-line class-methods-use-this
  onMessage () {
  }

  /**
   * Destroys the socket. Removes all deepstream specific
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
    this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.CLIENT_DISCONNECTED, this.user)
    this.removeAllListeners()
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
}

/**
 * Updates lastPreparedMessage and returns the [uws] prepared message.
 *
 * @param {String} message the message to be prepared
 *
 * @public
 * @returns {External} prepared message
 */
// eslint-disable-next-line class-methods-use-this
UwsSocketWrapper.prepareMessage = function (message) {
  return uws.native.server.prepareMessage(message, uws.OPCODE_TEXT)
}

/**
 * Finalizes the [uws] prepared message.
 *
 * @param {External} preparedMessage the prepared message to finalize
 *
 * @public
 * @returns {void}
 */
// eslint-disable-next-line class-methods-use-this
UwsSocketWrapper.finalizeMessage = function (preparedMessage) {
  uws.native.server.finalizeMessage(preparedMessage)
}

module.exports = UwsSocketWrapper
