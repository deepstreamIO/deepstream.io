import { TOPIC, CONNECTION_ACTION, ParseResult, Message } from '../../constants'
import { WebSocketServerConfig } from './connection-endpoint'
import { SocketConnectionEndpoint, StatefulSocketWrapper, DeepstreamServices, UnauthenticatedSocketWrapper, SocketWrapper, EVENT } from '@deepstream/types'

export abstract class WSSocketWrapper<SerializedType extends { length: number }> implements UnauthenticatedSocketWrapper {
  public abstract socketType: string
  public isRemote: false = false
  public isClosed: boolean = false
  public uuid: number = Math.random()
  public authCallback: Function | null = null
  public authAttempts: number = 0
  public lastMessageRecievedAt: number = 0

  private bufferedWrites: SerializedType[] = []
  private closeCallbacks: Set<Function> = new Set()

  public userId: string | null = null
  public serverData: object | null = null
  public clientData: object | null = null

  private bufferedWritesTotalByteSize: number = 0

  constructor (
    private socket: any,
    private handshakeData: any,
    private services: DeepstreamServices,
    private config: WebSocketServerConfig,
    private connectionEndpoint: SocketConnectionEndpoint,
    private isBinary: boolean
   ) {
  }

  get isOpen () {
    return this.isClosed !== true
  }

  protected invalidTypeReceived () {
    this.services.logger.error(EVENT.ERROR, `Received an invalid message type on ${this.uuid}`)
    this.destroy()
  }

  /**
   * Called by the connection endpoint to flush all buffered writes.
   * A buffered write is a write that is not a high priority, such as an ack
   * and can wait to be bundled into another message if necessary
   */
  public flush () {
    if (this.bufferedWritesTotalByteSize !== 0) {
      this.bufferedWrites.forEach((bw) => this.writeMessage(this.socket, bw))
      this.bufferedWritesTotalByteSize = 0
      this.bufferedWrites = []
    }
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTION } | Message, allowBuffering: boolean = true): void {
    this.services.monitoring.onMessageSend(message)
    this.sendBuiltMessage(this.getMessage(message), allowBuffering)
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendAckMessage (message: Message, allowBuffering: boolean = true): void {
    this.services.monitoring.onMessageSend(message)
    this.sendBuiltMessage(this.getAckMessage(message), allowBuffering)
  }

  public abstract getMessage (message: Message): SerializedType
  public abstract getAckMessage (message: Message): SerializedType
  public abstract parseMessage (message: SerializedType): ParseResult[]
  public abstract parseData (message: Message): true | Error

  public onMessage (messages: Message[]): void {
  }

  /**
   * Destroys the socket. Removes all deepstream specific
   * logic and closes the connection
   */
  public destroy (): void {
    try {
        this.socket.close()
    } catch (e) {
        this.socket.end()
    }
  }

  public close (): void {
    this.isClosed = true
    this.authCallback = null

    this.closeCallbacks.forEach((cb) => cb(this))
    this.services.logger.info(EVENT.CLIENT_DISCONNECTED, this.userId!)
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

  public sendBuiltMessage (message: SerializedType, buffer?: boolean): void {
    if (this.isOpen) {
      if (this.config.outgoingBufferTimeout === 0) {
        this.writeMessage(this.socket, message)
      } else if (!buffer) {
        this.flush()
        this.writeMessage(this.socket, message)
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

  protected writeMessage (socket: any, message: SerializedType) {
    this.services.httpService.sendWebsocketMessage(socket, message, this.isBinary)
  }
}
