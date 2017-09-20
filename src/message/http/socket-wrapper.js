'use strict'

/* eslint-disable class-methods-use-this */

const EventEmitter = require('events').EventEmitter

class HTTPSocketWrapper extends EventEmitter {
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
  sendError (topic, event, msg) {
    if (this.isClosed === false) {
      this._onError(
        this._messageResults,
        this._correlationIndex,
        topic,
        event,
        msg,
        this._responseCallback,
        this._requestTimeout
      )
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
  sendMessage (topic, action, data) {
    if (this.isClosed === false) {
      this._onMessage(
        this._messageResults,
        this._correlationIndex,
        topic,
        action,
        data,
        this._responseCallback,
        this._requestTimeout
      )
    }
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


module.exports = HTTPSocketWrapper
