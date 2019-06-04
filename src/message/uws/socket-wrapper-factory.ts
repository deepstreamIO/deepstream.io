import { EVENT, TOPIC, CONNECTION_ACTIONS, ParseResult, Message } from '../../constants'
import * as binaryMessageBuilder from '../../../binary-protocol/src/message-builder'
import * as binaryMessageParser from '../../../binary-protocol/src/message-parser'
import { WebSocketServerConfig } from '../websocket/connection-endpoint'
import { combineMultipleMessages } from '../../../binary-protocol/src/message-builder'
import { SocketWrapper, Logger, SocketConnectionEndpoint, StatefulSocketWrapper } from '../../types';

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 */
export class UwsSocketWrapper implements SocketWrapper {

  public isRemote: false = false
  public isClosed: boolean = false
  public user: string
  public uuid: number = Math.random()
  public authCallback: Function
  public authAttempts: number = 0

  private bufferedWrites: Buffer[]
  private closeCallbacks: Set<Function> = new Set()

  public authData: object
  public clientData: object
  private bufferedWritesTotalByteSize: number

  constructor (
    private socket: any,
    private handshakeData: any,
    private logger: Logger,
    private config: WebSocketServerConfig,
    private connectionEndpoint: SocketConnectionEndpoint
   ) {
    this.bufferedWritesTotalByteSize = 0
    this.bufferedWrites = []
  }

  get isOpen () {
    return this.isClosed !== true
  }

  /**
   * Called by the connection endpoint to flush all buffered writes.
   * A buffered write is a write that is not a high priority, such as an ack
   * and can wait to be bundled into another message if necessary
   */
  public flush () {
    if (this.bufferedWritesTotalByteSize !== 0) {
      this.socket.send(combineMultipleMessages(this.bufferedWrites, this.bufferedWritesTotalByteSize), true)
      this.bufferedWritesTotalByteSize = 0
      this.bufferedWrites = []
    }
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTIONS } | Message, allowBuffering: boolean = true): void {
    this.sendBinaryMessage(binaryMessageBuilder.getMessage(message, false), allowBuffering)
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendAckMessage (message: Message, allowBuffering: boolean = true): void {
    this.sendBinaryMessage(
        binaryMessageBuilder.getMessage(message, true),
        true
    )
  }

  public getMessage (message: Message): Buffer {
    return binaryMessageBuilder.getMessage(message, false)
  }

  public parseMessage (message: ArrayBuffer): ParseResult[] {
    /* we copy the underlying buffer (since a shallow reference won't be safe
     * outside of the callback)
     * the copy could be avoided if we make sure not to store references to the
     * raw buffer within the message
     */
    return binaryMessageParser.parse(Buffer.from(Buffer.from(message)))
  }

  public parseData (message: Message): true | Error {
    return binaryMessageParser.parseData(message)
  }

  public onMessage (messages: Message[]): void {
  }

  /**
   * Destroys the socket. Removes all deepstream specific
   * logic and closes the connection
   */
  public destroy (): void {
    this.socket.end()
  }

  public close (): void {
    this.isClosed = true
    delete this.authCallback

    this.closeCallbacks.forEach((cb) => cb(this))
    this.logger.info(EVENT.CLIENT_DISCONNECTED, this.user)
  }

  /**
   * Returns a map of parameters that were collected
   * during the initial http request that established the
   * connection
   */
  public getHandshakeData (): any {
    return this.handshakeData
  }

  public onClose (callback: (socketWrapper: StatefulSocketWrapper) => void): void {
    this.closeCallbacks.add(callback)
  }

  public removeOnClose (callback: (socketWrapper: StatefulSocketWrapper) => void): void {
    this.closeCallbacks.delete(callback)
  }

  public sendBinaryMessage (message: Buffer, buffer?: boolean): void {
    if (this.isOpen) {
      if (this.config.outgoingBufferTimeout === 0) {
        this.socket.send(message, true)
      } else if (!buffer) {
        this.flush()
        this.socket.send(message, true)
      } else {
        this.bufferedWritesTotalByteSize += message.length
        this.bufferedWrites.push(message)
        this.connectionEndpoint.scheduleFlush(this)
      }
    }
  }
}

export const createUWSSocketWrapper = function (
  socket: any,
  handshakeData: any,
  logger: Logger,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint
) { return new UwsSocketWrapper(socket, handshakeData, logger, config, connectionEndpoint) }
