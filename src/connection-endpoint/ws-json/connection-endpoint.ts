import ConnectionEndpoint, {WebSocketServerConfig} from '../base-websocket/connection-endpoint'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, SocketWrapper, DeepstreamConfig, UnauthenticatedSocketWrapper, SocketHandshakeData } from '../../../ds-types/src/index'
import * as WebSocket from 'ws'

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class WSJSONConnectionEndpoint extends ConnectionEndpoint {
  private server!: WebSocket.Server
  private connections = new Map<WebSocket, UnauthenticatedSocketWrapper>()

  constructor (private wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)
    this.description = 'WS JSON Connection Endpoint (ONLY FOR SDK DEVELOPMENT)'
    this.onMessages = this.onMessages.bind(this)
  }

  /**
   * Initialize the ws endpoint, setup callbacks etc.
   */
  public createWebsocketServer () {
    this.server = new WebSocket.Server({ noServer: true })
    this.services.httpService.registerWSUpgradePath(this.wsOptions.urlPath, this.server)
    this.server.on('connection', (websocket, handshakeData: SocketHandshakeData) => {
      const socketWrapper = this.createWebsocketWrapper(websocket, handshakeData)
      this.connections.set(websocket, socketWrapper)

      websocket.on('close', () => {
        this.onSocketClose(this.connections.get(websocket))
        this.connections.delete(websocket)
      })

      websocket.on('message', (msg: string) => {
        this.connections.get(websocket)!.onMessage([JSON.parse(msg)])
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

  /**
   * Receives a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user
   * and subscribes to authentication messages.
   */
  public createWebsocketWrapper (websocket: WebSocket, handshakeData: SocketHandshakeData): UnauthenticatedSocketWrapper {
    return createWSSocketWrapper(websocket, handshakeData, this.services, this.wsOptions, this)
  }

  public onSocketWrapperClosed (socketWrapper: SocketWrapper) {
    socketWrapper.close()
  }
}
