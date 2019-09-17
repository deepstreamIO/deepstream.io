import ConnectionEndpoint, {WebSocketServerConfig} from '../websocket/connection-endpoint'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, SocketWrapper, DeepstreamConfig, UnauthenticatedSocketWrapper } from '../../../ds-types/src/index'
import { Dictionary } from 'ts-essentials'
import * as WebSocket from 'ws'
import { IncomingMessage, Server } from 'http'

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class WSJSONConnectionEndpoint extends ConnectionEndpoint {
  private server!: WebSocket.Server
  private connections = new Map<WebSocket, UnauthenticatedSocketWrapper>()
  private httpServer: Server

  constructor (private wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)
    this.description = 'WS JSON Connection Endpoint (ONLY FOR SDK DEVELOPMENT)'
    this.onMessages = this.onMessages.bind(this)
    this.httpServer = this.wsOptions.httpServer ? this.wsOptions.httpServer : new Server()
  }

  /**
   * Initialize the ws endpoint, setup callbacks etc.
   */
  public createWebsocketServer () {
    this.server = new WebSocket.Server({
      server: this.httpServer
    })
    if (this.wsOptions.httpServer) {
      process.nextTick(this.onReady.bind(this))
    } else {
      this.httpServer.on('request', (request, response) => {
        if (request.url === this.wsOptions.healthCheckPath && request.method === 'GET') {
          response.end()
        } else {
          response.writeHead(404)
          response.end(`Only ${this.wsOptions.healthCheckPath} supported`)
        }
      })
      this.httpServer.listen(this.getOption('port'), this.getOption('host'), this.onReady.bind(this))
    }

    this.server.on('connection', (websocket, request) => {
      const socketWrapper = this.createWebsocketWrapper(websocket, request)
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

  public static getHeaders (desiredHeaders: string[], req: IncomingMessage) {
    const headers: Dictionary<string> = {}
    for (const wantedHeader of desiredHeaders) {
      headers[wantedHeader] = req.headers[wantedHeader] as string
    }
    return headers
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
    return new Promise((resolve) => this.httpServer.close(resolve))
  }

  /**
   * Receives a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user
   * and subscribes to authentication messages.
   */
  public createWebsocketWrapper (websocket: WebSocket, req: IncomingMessage): UnauthenticatedSocketWrapper {
    const handshakeData = {
      remoteAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      headers: WSJSONConnectionEndpoint.getHeaders(this.wsOptions.headers, req),
      referer: req.headers.referer
    }
    const socketWrapper = createWSSocketWrapper(
        websocket, handshakeData, this.services, this.wsOptions, this
    )
    return socketWrapper
  }

  public onSocketWrapperClosed (socketWrapper: SocketWrapper) {
    socketWrapper.close()
  }
}
