import { parseData } from '@deepstream/protobuf/dist/src/message-parser'
import { EventEmitter } from 'events'
import { DeepstreamServices, UnauthenticatedSocketWrapper, EVENT, DeepstreamAuthenticationResult } from '@deepstream/types'
import { Message, ParseResult } from '../../constants'

export default class HTTPSocketWrapper extends EventEmitter implements UnauthenticatedSocketWrapper {
  public socketType = 'http'
  public userId: string | null = null
  public serverData: object | null = null
  public clientData: object | null = null

  public uuid: number = Math.random()

  private correlationIndex: number = -1
  private messageResults: any[] = []
  private responseCallback: Function | null = null
  private requestTimeout: NodeJS.Timeout | null = null

  public authCallback: Function | null = null
  public isRemote: boolean = false
  public isClosed: boolean = false
  // TODO: This isn't used here but is part of a stateful socketWrapper
  public authAttempts = 0

  constructor (private services: DeepstreamServices, private onMessageCallback: Function, private onErrorCallback: Function) {
    super()
  }

  public init (
    authResponseData: DeepstreamAuthenticationResult,
    messageIndex: number,
    messageResults: any[],
    responseCallback: Function,
    requestTimeoutId: NodeJS.Timeout
   ) {
    this.userId = authResponseData.id || 'OPEN'
    this.clientData = authResponseData.clientData || null
    this.serverData = authResponseData.serverData || null

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
  public sendError (message: Message, event: EVENT, errorMessage: string) {
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
    if (message.action >= 100) {
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

  public parseMessage (serializedMessage: any): ParseResult[] {
    throw new Error('Method not implemented.')
  }

  /**
   * Destroys the socket. Removes all deepstream specific
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
