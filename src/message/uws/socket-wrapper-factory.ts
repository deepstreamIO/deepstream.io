import { EVENT, TOPIC, CONNECTION_ACTIONS, ParseResult, Message } from '../../constants'
import * as binaryMessageBuilder from '../../../binary-protocol/src/message-builder'
import * as binaryMessageParser from '../../../binary-protocol/src/message-parser'
import { WebSocketServerConfig } from '../websocket/connection-endpoint'

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

  private bufferedWrites: Array<Buffer>
  private closeCallbacks: Set<Function> = new Set()

  public authData: object
  public clientData: object

  constructor (
    private socket: any,
    private handshakeData: any,
    private logger: Logger,
    private config: WebSocketServerConfig,
    private connectionEndpoint: SocketConnectionEndpoint
   ) {
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
    if (this.bufferedWrites.length !== 0) {
      this.socket.send(Buffer.concat(this.bufferedWrites), true)
      this.bufferedWrites = []
    }
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTIONS } | Message, allowBuffering: boolean): void {
    this.sendBinaryMessage(
        binaryMessageBuilder.getMessage(message, false),
        allowBuffering
    )
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendAckMessage (message: Message, allowBuffering: boolean): void {
    this.sendBinaryMessage(
        binaryMessageBuilder.getMessage(message, true),
        true
    )
  }

  public getMessage (message: Message): Buffer {
    return binaryMessageBuilder.getMessage(message, false)
  }

  public parseMessage (message: ArrayBuffer): Array<ParseResult> {
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

  public onMessage (messages: Array<Message>): void {
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

    this.closeCallbacks.forEach(cb => cb())
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

  public onClose (callback: Function): void {
    this.closeCallbacks.add(callback)
  }

  public removeOnClose (callback: Function): void {
    this.closeCallbacks.delete(callback)
  }

  public sendBinaryMessage (binaryMessage: Buffer, allowBuffering: boolean) {
    if (this.isOpen) {
      if (this.config.outgoingBufferTimeout === 0) {
        this.socket.send(binaryMessage, true)
      } else if (!allowBuffering) {
        this.flush()
        this.socket.send(Buffer.concat(this.bufferedWrites), true)
        this.bufferedWrites = []
      } else {
        this.bufferedWrites.push(binaryMessage)
        this.connectionEndpoint.scheduleFlush(this)
      }
    }
  }
}

export function createUWSSocketWrapper (
  socket: any,
  handshakeData: any,
  logger: Logger,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint
) { return new UwsSocketWrapper(socket, handshakeData, logger, config, connectionEndpoint) }
