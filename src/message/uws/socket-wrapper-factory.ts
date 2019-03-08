import { EVENT, TOPIC, CONNECTION_ACTIONS, ParseResult, Message } from '../../constants'
import * as binaryMessageBuilder from '../../../binary-protocol/src/message-builder'
import * as binaryMessageParser from '../../../binary-protocol/src/message-parser'

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
  public onCloseCallbacks: Array<Function>

  private bufferedWrites: string = ''

  public authData: object
  public clientData: object

  constructor (
    private socket: any,
    private handshakeData: any,
    private logger: Logger,
    private config: any,
    private connectionEndpoint: ConnectionEndpoint
   ) {
  }

  get isOpen() {
    return this.isClosed !== true
  }

  /**
   * Called by the connection endpoint to flush all buffered writes.
   * A buffered write is a write that is not a high priority, such as an ack
   * and can wait to be bundled into another message if necessary
   */
  public flush () {
    if (this.bufferedWrites !== '') {
      this.socket.send(this.bufferedWrites)
      this.bufferedWrites = ''
    }
  }

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTIONS } | Message, allowBuffering: boolean): void {
    if (this.isOpen) {
      if (this.config.outgoingBufferTimeout === 0) {
        this.socket.send(message)
      } else if (!allowBuffering) {
        this.flush()
        this.socket.send(message)
      } else {
        this.bufferedWrites += message
        this.connectionEndpoint!.scheduleFlush(this)
      }
    }
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

  /**
   * Sends a message based on the provided action and topic
   * @param {Boolean} allowBuffering Boolean to indicate that buffering is allowed on
   *                                 this message type
   */
  public sendAckMessage (message: Message, allowBuffering: boolean): void {
    if (this.isOpen) {
      this.sendMessage(
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
  }

  public close (): void {
    this.isClosed = true
    delete this.authCallback

    this.onCloseCallbacks.forEach(cb => cb())
    this.logger.info(EVENT.CLIENT_DISCONNECTED, this.user)

    // Run all close callbacks
  }

  /**
   * Returns a map of parameters that were collected
   * during the initial http request that established the
   * connection
   */
  public getHandshakeData (): any {
    return this.handshakeData
  }

  public onClose (): void {

  }
}

export function createUWSSocketWrapper (
  socket: any,
  handshakeData: any,
  logger: Logger,
  config: DeepstreamConfig,
  connectionEndpoint: ConnectionEndpoint
) { return new UwsSocketWrapper(socket, handshakeData, logger, config, connectionEndpoint) }
