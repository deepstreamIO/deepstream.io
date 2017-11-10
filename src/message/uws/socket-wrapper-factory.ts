import { EVENT, TOPIC, CONNECTION_ACTIONS, AUTH_ACTIONS, ParseResult, Message } from '../../constants'
import * as binaryMessageBuilder from '../../../protocol/binary/src/message-builder'
import * as binaryMessageParser from '../../../protocol/binary/src/message-parser'
import * as uws from 'uws'
import { EventEmitter } from 'events'

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
export class UwsSocketWrapper extends EventEmitter implements SocketWrapper {

  public isClosed: boolean = false
  public user: string
  public uuid: number = Math.random()
  public __id: number
  public authCallback: Function
  public authAttempts: number = 0

  private bufferedWrites: string = ''

  public static lastPreparedMessage: any

  public authData: object
  public isRemote: boolean

  constructor (
    private external: any,
    private handshakeData: any,
    private logger: Logger,
    private config: any,
    private connectionEndpoint: ConnectionEndpoint
   ) {
    super()
    this.setMaxListeners(0)
  }

  /**
   * Updates lastPreparedMessage and returns the [uws] prepared message.
   */
  public prepareMessage (message: string): string {
    UwsSocketWrapper.lastPreparedMessage = uws.native.server.prepareMessage(message, uws.OPCODE_BINARY)
    return UwsSocketWrapper.lastPreparedMessage
  }

  /**
   * Sends the [uws] prepared message, or in case of testing sends the
   * last prepared message.
   */
  public sendPrepared (preparedMessage): void {
    this.flush()
    uws.native.server.sendPrepared(this.external, preparedMessage)
  }

  /**
   * Finalizes the [uws] prepared message.
   */
  public finalizeMessage (preparedMessage: string): void {
    uws.native.server.finalizeMessage(preparedMessage)
  }

  /**
   * Variant of send with no particular checks or appends of message.
   */
  public sendNative (message: string | Buffer, allowBuffering: boolean): void {
    uws.native.server.send(this.external, message, uws.OPCODE_BINARY)
    /*
     *if (this.config.outgoingBufferTimeout === 0) {
     *  uws.native.server.send(this.external, message, uws.OPCODE_TEXT)
     *} else if (!allowBuffering) {
     *  this.flush()
     *  uws.native.server.send(this.external, message, uws.OPCODE_TEXT)
     *} else {
     *  this.bufferedWrites += message
     *  if (this.connectionEndpoint.scheduleFlush) {
     *    this.connectionEndpoint.scheduleFlush(this)
     *  }
     *}
     */
  }

  /**
   * Called by the connection endpoint to flush all buffered writes.
   * A buffered write is a write that is not a high priority, such as an ack
   * and can wait to be bundled into another message if necessary
   */
  public flush () {
    if (this.bufferedWrites !== '') {
      uws.native.server.send(this.external, this.bufferedWrites, uws.OPCODE_BINARY)
      this.bufferedWrites = ''
    }
  }

  /**
   * Sends an error on the specified topic. The
   * action will automatically be set to C.ACTION.ERROR
   */
  public sendError (
    message: Message,
    action: EVENT,
    errorMessage: string,
    allowBuffering: boolean
  ): void {
    if (this.isClosed === false) {
      this.sendNative(
        binaryMessageBuilder.getErrorMessage(message, action, errorMessage),
        allowBuffering
      )
    }
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTIONS } | Message, allowBuffering: boolean): void {
    if (this.isClosed === false) {
      this.sendNative(
        binaryMessageBuilder.getMessage(message, false),
        allowBuffering
      )
    }
  }

  public getMessage (message: Message): Buffer {
    return binaryMessageBuilder.getMessage(message, false)
  }

  public parseMessage (message: string | ArrayBuffer): Array<ParseResult> {
    let messageBuffer: string | Buffer
    if (message instanceof ArrayBuffer) {
      /* we copy the underlying buffer (since a shallow reference won't be safe
       * outside of the callback)
       * the copy could be avoided if we make sure not to store references to the
       * raw buffer within the message
       */
      messageBuffer = Buffer.from(Buffer.from(message))
    } else {
      // return textMessageParser.parse(message)
      console.error('received string message', message)
      return []
    }
    return binaryMessageParser.parse(messageBuffer)
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendAckMessage (message: Message, allowBuffering: boolean): void {
    if (this.isClosed === false) {
      this.sendNative(
        binaryMessageBuilder.getMessage(message, true),
        allowBuffering
      )
    }
  }

  public parseData (message: Message): true | Error {
    return binaryMessageParser.parseData(message)
  }

  public onMessage (messages: Array<Message>): void {
  }

  /**
   * Destroys the socket. Removes all deepstream specific
   * logic and closes the connection
   */
  public destroy (): void {
    uws.native.server.terminate(this.external)
  }

  public close (): void {
    this.isClosed = true
    delete this.authCallback
    this.emit('close', this)
    this.logger.info(EVENT.CLIENT_DISCONNECTED, this.user)
    this.removeAllListeners()
  }

  /**
   * Returns a map of parameters that were collected
   * during the initial http request that established the
   * connection
   */
  public getHandshakeData (): any {
    return this.handshakeData
  }
}

UwsSocketWrapper.lastPreparedMessage = null

export function createSocketWrapper (
  external: any,
  handshakeData: any,
  logger: Logger,
  config: DeepstreamConfig,
  connectionEndpoint: ConnectionEndpoint
) { return new UwsSocketWrapper(external, handshakeData, logger, config, connectionEndpoint) }
