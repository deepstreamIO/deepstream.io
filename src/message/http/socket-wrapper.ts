'use strict'

/* eslint-disable class-methods-use-this */
import { EventEmitter } from 'events'
import { parseData, isError } from '../../../binary-protocol/src/message-parser'

export default class HTTPSocketWrapper extends EventEmitter implements SocketWrapper {

  public user: string
  public uuid: number = Math.random()

  private _onMessage: Function
  private _onError: Function
  private _correlationIndex
  private _messageResults
  private _responseCallback
  private _requestTimeout

  authData: object
  clientData: object
  authCallback: Function
  isRemote: boolean
  isClosed: boolean = false

  constructor (options, onMessage, onError) {
    super()

    this._onMessage = onMessage
    this._onError = onError
  }

  init (
    authResponseData: any,
    messageIndex,
    messageResults,
    responseCallback,
    requestTimeoutId
   ) {
    this.user = authResponseData.userId || authResponseData.username || 'OPEN'
    this.clientData = authResponseData.clientData
    this.authData = authResponseData.serverData

    this._correlationIndex = messageIndex
    this._messageResults = messageResults
    this._responseCallback = responseCallback
    this._requestTimeout = requestTimeoutId
  }

  close () {
    this.isClosed = true
  }

  prepareMessage () {
  }

  sendPrepared () {
  }

  sendNative () {
  }

  finalizeMessage () {
  }

  flush () {
  }

  onMessage () {
  }

  getMessage () {
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
      parseData(message)
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
    if (isError(message)) {
      message.isError = true
    }
    if (this.isClosed === false) {
      parseData(message)
      this._onMessage(
        this._messageResults,
        this._correlationIndex,
        message,
        this._responseCallback,
        this._requestTimeout
      )
    }
  }

  sendNativeMessage(message: any, buffer?: boolean): void {
    // This can never be called as HTTP API is not a subscriber (Yet)
  }

  sendAckMessage (message) {
    message.isAck = true
    this.sendMessage(message)
  }

  parseData (message) {
    return parseData(message)
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

  onClose () {
  }
}
