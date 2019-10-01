import ConnectionEndpoint, {WebSocketServerConfig} from '../base-websocket/connection-endpoint'
import { DeepstreamServices, SocketWrapper, DeepstreamConfig, UnauthenticatedSocketWrapper, SocketHandshakeData } from '../../../ds-types/src/index'
import * as WebSocket from 'ws'

export class BaseWSConnectionEndpoint<Config extends WebSocketServerConfig> extends ConnectionEndpoint {
  private server!: WebSocket.Server
  private connections = new Map<WebSocket, UnauthenticatedSocketWrapper>()

  constructor (
    private wsOptions: WebSocketServerConfig,
    services: DeepstreamServices,
    config: DeepstreamConfig,
    private createWSSocketWrapper: Function
  ) {
    super(wsOptions, services, config)
    this.onMessages = this.onMessages.bind(this)
  }

  /**
   * Initialize the ws endpoint, setup callbacks etc.
   */
  public createWebsocketServer () {
    this.server = new WebSocket.Server({ noServer: true })
    this.services.httpService.registerWSUpgradePath(this.wsOptions.urlPath, this.server)
    this.server.on('connection', (websocket, handshakeData: SocketHandshakeData) => {
      const socketWrapper = this.createWSSocketWrapper(websocket, handshakeData, this.services, this.wsOptions, this)
      this.connections.set(websocket, socketWrapper)

      websocket.on('close', () => {
        this.onSocketClose(this.connections.get(websocket))
        this.connections.delete(websocket)
      })

      websocket.on('message', (msg: string) => {
        const messages = socketWrapper.parseMessage(msg)
        // This ignores pings
        if (messages.length > 0) {
          this.connections.get(websocket)!.onMessage(messages)
        }
      })

      this.onConnection(socketWrapper)
    })

    return this.server
  }

  public async closeWebsocketServer () {
    const closePromises: Array<Promise<void>> = []
    this.connections.forEach((conn) => {
      if (!conn.isClosed) {
        closePromises.push(new Promise((resolve) => conn.onClose(resolve)))
        conn.destroy()
      }
    })
    await Promise.all(closePromises)
    this.connections.clear()
  }

  public onSocketWrapperClosed (socketWrapper: SocketWrapper) {
    socketWrapper.close()
  }
}
