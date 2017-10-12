'use strict'

import { EVENT, TOPIC, CONNECTION_ACTIONS, AUTH_ACTIONS } from '../../constants'
import * as messageBuilder from '../../../protocol/text/src/message-builder'
import * as messageParser from '../../../protocol/text/src/message-parser'
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
class UwsSocketWrapper extends EventEmitter implements SocketWrapper {

  public isClosed: boolean = false
  public user: string
  public uuid: number = Math.random()
  public __id: number
  public authCallback: Function

  private authAttempts: number = 0
  private bufferedWrites: string = ''

  static lastPreparedMessage: any

  authData: object
  isRemote: boolean

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
   *
   * @param {String} message the message to be prepared
   *
   * @public
   * @returns {External} prepared message
   */
  // eslint-disable-next-line class-methods-use-this
  public prepareMessage (message: string) {
    UwsSocketWrapper.lastPreparedMessage = uws.native.server.prepareMessage(message, uws.OPCODE_TEXT)
    return UwsSocketWrapper.lastPreparedMessage
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
  public sendPrepared (preparedMessage) {
    this.flush()
    uws.native.server.sendPrepared(this.external, preparedMessage)
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
  public finalizeMessage (preparedMessage: any): void {
    uws.native.server.finalizeMessage(preparedMessage)
  }

  /**
   * Variant of send with no particular checks or appends of message.
   *
   * @param {String} message the message to send
   *
   * @public
   * @returns {void}
   */
  public sendNative (message: any, allowBuffering: boolean): void {
    if (this.config.outgoingBufferTimeout === 0) {
      uws.native.server.send(this.external, message, uws.OPCODE_TEXT)
    } else if (!allowBuffering) {
      this.flush()
      uws.native.server.send(this.external, message, uws.OPCODE_TEXT)
    } else {
      this.bufferedWrites += message
      if (this.connectionEndpoint.scheduleFlush) {
        this.connectionEndpoint.scheduleFlush(this)
      }
    }
  }

  /**
   * Called by the connection endpoint to flush all buffered writes.
   * A buffered write is a write that is not a high priority, such as an ack
   * and can wait to be bundled into another message if necessary
   */
  public flush () {
    if (this.bufferedWrites !== '') {
      uws.native.server.send(this.external, this.bufferedWrites, uws.OPCODE_TEXT)
      this.bufferedWrites = ''
    }
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
  public sendError (
    message: Message,
    event: EVENT,
    errorMessage: string,
    allowBuffering: boolean
  ): void {
    if (this.isClosed === false) {
      this.sendNative(
        messageBuilder.getErrorMessage(message, event, errorMessage),
        allowBuffering
      )
    }
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   *
   * @public
   * @returns {void}
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTIONS } | Message, allowBuffering) {
    if (this.isClosed === false) {
      this.sendNative(
        messageBuilder.getMessage(message, false),
        allowBuffering
      )
    }
  }

  // eslint-disable-next-line
  public getMessage (message: Message): string | void {
    return messageBuilder.getMessage(message, false)
  }

  // eslint-disable-next-line
  public parseMessage (message: string): Array<Message> {
    return messageParser.parse(message)
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   *
   * @public
   * @returns {void}
   */
  public sendAckMessage (message: Message, allowBuffering: boolean): void {
    if (this.isClosed === false) {
      this.sendNative(
        messageBuilder.getMessage(message, true),
        allowBuffering
      )
    }
  }

  // eslint-disable-next-line
  public parseData (message): void {
    return messageParser.parseData(message)
  }

  // eslint-disable-next-line class-methods-use-this
  public onMessage (): void {
  }

  /**
   * Destroys the socket. Removes all deepstream specific
   * logic and closes the connection
   *
   * @public
   * @returns {void}
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
   *
   * @public
   * @returns {Object} handshakeData
   */
  public getHandshakeData (): string {
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
