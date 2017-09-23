'use strict'

/* eslint-disable class-methods-use-this */
const EventEmitter = require('events').EventEmitter

module.exports = class HTTPSocketWrapper extends EventEmitter {
  constructor (options, onMessage, onError) {
    super()

    this.uuid = Math.random()
    this._onMessage = onMessage
    this._onError = onError
  }

  init (authResponseData, messageIndex, messageResults, responseCallback, requestTimeoutId) {
    this.isClosed = false

    this.user = authResponseData.userId || authResponseData.username
    this.authData = authResponseData.serverData

    this._correlationIndex = messageIndex
    this._messageResults = messageResults
    this._responseCallback = responseCallback
    this._requestTimeout = requestTimeoutId
  }

  close () {
    this.isClosed = true
  }

  static prepareMessage () {
  }

  sendPrepared () {
  }

  sendNative () {
  }

  static finalizeMessage () {
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
    return {}
  }

  /**
   * Sends an error on the specified topic. The
   * action will automatically be set to C.ACTION.ERROR
   *
   * @param {String} topic one of C.TOPIC
   * @param {String} event one of C.EVENT
   * @param {String} msg generic error message
   *
   * @public
   * @returns {void}
   */
  sendError (message, event, errorMessage) {
    if (this.isClosed === false) {
      this._onError(
        this._messageResults,
        this._correlationIndex,
        message,
        event,
        errorMessage,
        this._responseCallback,
        this._requestTimeout
      )
    }
  }

  /**
   * Sends a message based on the provided action and topic
   *
   * @param {Object} message
   *
   * @public
   * @returns {void}
   */
  sendMessage (message) {
    if (this.isClosed === false) {
      this._onMessage(
        this._messageResults,
        this._correlationIndex,
        message,
        this._responseCallback,
        this._requestTimeout
      )
    }
  }

  sendAckMessage (message) {
    message.isAck = true
    this.sendMessage(message)
  }

  parseData (message) {
    return message.parsedData
  }

  /**
   * Destroyes the socket. Removes all deepstream specific
   * logic and closes the connection
   *
   * @public
   * @returns {void}
   */
  destroy () {
  }
}
