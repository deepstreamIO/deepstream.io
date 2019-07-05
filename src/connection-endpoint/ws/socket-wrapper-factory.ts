import { EVENT, TOPIC, CONNECTION_ACTIONS, ParseResult, Message } from '../../constants'
import * as binaryMessageBuilder from '../../../binary-protocol/src/message-builder'
import * as binaryMessageParser from '../../../binary-protocol/src/message-parser'
import { WebSocketServerConfig } from '../websocket/connection-endpoint'
import { combineMultipleMessages } from '../../../binary-protocol/src/message-builder'
import { SocketConnectionEndpoint, StatefulSocketWrapper, DeepstreamServices, UnauthenticatedSocketWrapper, SocketWrapper } from '../../types'
import * as WebSocket from 'ws'

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 */
export class WSSocketWrapper implements UnauthenticatedSocketWrapper {

  public isRemote: false = false
  public isClosed: boolean = false
  public user: string | null = null
  public uuid: number = Math.random()
  public authCallback: Function | null = null
  public authAttempts: number = 0

  private bufferedWrites: Buffer[]
  private closeCallbacks: Set<Function> = new Set()

  public authData: object | null = null
  public clientData: object | null = null
  private bufferedWritesTotalByteSize: number

  constructor (
    private socket: WebSocket,
    private handshakeData: any,
    private services: DeepstreamServices,
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
      this.socket.send(combineMultipleMessages(this.bufferedWrites, this.bufferedWritesTotalByteSize))
      this.bufferedWritesTotalByteSize = 0
      this.bufferedWrites = []
    }
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTIONS } | Message, allowBuffering: boolean = true): void {
    this.sendBuiltMessage(binaryMessageBuilder.getMessage(message, false), allowBuffering)
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendAckMessage (message: Message, allowBuffering: boolean = true): void {
    this.sendBuiltMessage(
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
    this.socket.close()
  }

  public close (): void {
    this.isClosed = true
    delete this.authCallback

    this.closeCallbacks.forEach((cb) => cb(this))
    this.services.logger.info(EVENT.CLIENT_DISCONNECTED, this.user!)
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

  public sendBuiltMessage (message: Buffer, buffer?: boolean): void {
    if (this.isOpen) {
      if (this.config.outgoingBufferTimeout === 0) {
        this.socket.send(message)
      } else if (!buffer) {
        this.flush()
        this.socket.send(message)
      } else {
        this.bufferedWritesTotalByteSize += message.length
        this.bufferedWrites.push(message)
        if (this.bufferedWritesTotalByteSize > this.config.maxBufferByteSize) {
          this.flush()
        } else {
          this.connectionEndpoint.scheduleFlush(this as SocketWrapper)
        }
      }
    }
  }
}

export const createWSSocketWrapper = function (
  socket: any,
  handshakeData: any,
  services: DeepstreamServices,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint
) { return new WSSocketWrapper(socket, handshakeData, services, config, connectionEndpoint) }
