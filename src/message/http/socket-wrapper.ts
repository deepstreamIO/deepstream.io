import { EventEmitter } from 'events'
import { parseData, isError } from '../../../binary-protocol/src/message-parser'
import { DeepstreamServices, UnauthenticatedSocketWrapper } from '../../types'
import { Message } from '../../constants'

export default class HTTPSocketWrapper extends EventEmitter implements UnauthenticatedSocketWrapper {
  public user: string | null = null
  public uuid: number = Math.random()

  private correlationIndex: number = -1
  private messageResults: any[] = []
  private responseCallback: Function | null = null
  private requestTimeout: NodeJS.Timeout | null = null

  public authData: object | null = null
  public clientData: object | null = null
  public authCallback: Function | null = null
  public isRemote: boolean = false
  public isClosed: boolean = false

  constructor (private services: DeepstreamServices, private onMessageCallback: Function, private onErrorCallback: Function) {
    super()
  }

  public init (
    authResponseData: any,
    messageIndex: number,
    messageResults: any[],
    responseCallback: Function,
    requestTimeoutId: NodeJS.Timeout
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
   */
  public getHandshakeData () {
    return {}
  }

  /**
   * Sends an error on the specified topic. The
   * action will automatically be set to C.ACTION.ERROR
   */
  public sendError (message: Message, event: Event, errorMessage: string) {
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
   */
  public sendMessage (message: Message) {
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

  public sendAckMessage (message: Message) {
    message.isAck = true
    this.sendMessage(message)
  }

  public parseData (message: Message) {
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
