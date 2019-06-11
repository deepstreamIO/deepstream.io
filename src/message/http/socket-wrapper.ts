'use strict'

/* eslint-disable class-methods-use-this */
import { EventEmitter } from 'events'
import { parseData, isError } from '../../../binary-protocol/src/message-parser'
import { SocketWrapper, DeepstreamServices } from '../../types'

export default class HTTPSocketWrapper extends EventEmitter implements SocketWrapper {

  public user: string
  public uuid: number = Math.random()

  private correlationIndex
  private messageResults
  private responseCallback
  private requestTimeout

  public authData: object
  public clientData: object
  public authCallback: Function
  public isRemote: boolean
  public isClosed: boolean = false

  constructor (options, private services: DeepstreamServices, private onMessageCallback, private onErrorCallback) {
    super()
  }

  public init (
    authResponseData: any,
    messageIndex,
    messageResults,
    responseCallback,
    requestTimeoutId
   ) {
    this.user = authResponseData.userId || authResponseData.username || 'OPEN'
    this.clientData = authResponseData.clientData
    this.authData = authResponseData.serverData

    this.correlationIndex = messageIndex
    this.messageResults = messageResults
    this.responseCallback = responseCallback
    this.requestTimeout = requestTimeoutId
  }

  public close () {
    this.isClosed = true
  }

  public flush () {
  }

  public onMessage () {
  }

  public getMessage () {
  }

  /**
   * Returns a map of parameters that were collected
   * during the initial http request that established the
   * connection
   *
   * @public
   * @returns {Object} handshakeData
   */
  public getHandshakeData () {
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
  public sendError (message, event, errorMessage) {
    if (this.isClosed === false) {
      parseData(message)
      this.onErrorCallback(
        this.messageResults,
        this.correlationIndex,
        message,
        event,
        errorMessage,
        this.responseCallback,
        this.requestTimeout
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
  public sendMessage (message) {
    if (isError(message)) {
      message.isError = true
    }
    if (this.isClosed === false) {
      this.services.monitoring.onMessageSend(message)

      parseData(message)
      this.onMessageCallback(
        this.messageResults,
        this.correlationIndex,
        message,
        this.responseCallback,
        this.requestTimeout
      )
    }
  }

  public sendNativeMessage (message: any, buffer?: boolean): void {
    // This can never be called as HTTP API is not a subscriber (Yet)
  }

  public sendAckMessage (message) {
    message.isAck = true
    this.sendMessage(message)
  }

  public parseData (message) {
    return parseData(message)
  }

  /**
   * Destroyes the socket. Removes all deepstream specific
   * logic and closes the connection
   *
   * @public
   * @returns {void}
   */
  public destroy () {
  }

  public onClose () {
  }

  public removeOnClose () {
  }
}
