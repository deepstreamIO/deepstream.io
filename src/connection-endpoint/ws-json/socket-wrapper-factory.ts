import { TOPIC, CONNECTION_ACTION, ParseResult, Message } from '../../constants'
import { WebSocketServerConfig } from '../base-websocket/connection-endpoint'
import { SocketConnectionEndpoint, StatefulSocketWrapper, DeepstreamServices, UnauthenticatedSocketWrapper, EVENT } from '../../../ds-types/src/index'
import * as WebSocket from 'ws'

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 */
export class JSONSocketWrapper implements UnauthenticatedSocketWrapper {
  public isRemote: false = false
  public isClosed: boolean = false
  public user: string | null = null
  public uuid: number = Math.random()
  public authCallback: Function | null = null
  public authAttempts: number = 0

  private bufferedWrites: Uint8Array[] = []
  private closeCallbacks: Set<Function> = new Set()

  public authData: object | null = null
  public clientData: object | null = null
  private bufferedWritesTotalByteSize: number = 0

  constructor (
    private socket: WebSocket,
    private handshakeData: any,
    private services: DeepstreamServices,
    config: WebSocketServerConfig,
    connectionEndpoint: SocketConnectionEndpoint
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
    if (this.bufferedWritesTotalByteSize !== 0) {
      this.bufferedWrites.forEach((bw) => this.socket.send(bw))
      this.bufferedWritesTotalByteSize = 0
      this.bufferedWrites = []
    }
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTION } | Message, allowBuffering: boolean = true): void {
    this.services.monitoring.onMessageSend(message)
    this.sendBuiltMessage(JSON.stringify(message), allowBuffering)
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendAckMessage (message: Message, allowBuffering: boolean = true): void {
    this.services.monitoring.onMessageSend(message)
    this.sendBuiltMessage(
        JSON.stringify({ ...message, isAck: true })
    )
  }

  public getMessage (message: Message): string {
    return JSON.stringify(message)
  }

  public parseMessage (message: string): ParseResult[] {
    return JSON.parse(message)
  }

  public parseData (message: Message): true | Error {
    try {
      if (message.data) {
        message.parsedData = JSON.parse(message.data as string)
      }
      return true
    } catch (e) {
      return e
    }
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

  public sendBuiltMessage (message: string, buffer?: boolean): void {
    if (this.isOpen) {
        this.socket.send(message)
    }
  }
}

export const createWSSocketWrapper = function (
  socket: any,
  handshakeData: any,
  services: DeepstreamServices,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint
) { return new JSONSocketWrapper(socket, handshakeData, services, config, connectionEndpoint) }
