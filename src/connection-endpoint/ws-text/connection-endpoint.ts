import ConnectionEndpoint, {WebSocketServerConfig} from '../base-websocket/connection-endpoint'
import * as textMessageParser from './protocol/message-parser'
import * as textMessageBuilder from './protocol/message-builder'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, SocketWrapper, DeepstreamConfig, UnauthenticatedSocketWrapper, SocketHandshakeData } from '../../../ds-types/src/index'
import * as WebSocket from 'ws'
import { TOPIC, CONNECTION_ACTION } from '../../constants'

interface WSConnectionEndpointConfig extends WebSocketServerConfig {
  heartbeatInterval: number
}

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class WSTextConnectionEndpoint extends ConnectionEndpoint {
  private server!: WebSocket.Server
  private connections = new Map<WebSocket, UnauthenticatedSocketWrapper>()
  private pingMessage: string

  constructor (private wsOptions: WSConnectionEndpointConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)
    this.description = 'WS Text Protocol Connection Endpoint'
    this.onMessages = this.onMessages.bind(this)
    this.pingMessage = textMessageBuilder.getMessage({
      topic: TOPIC.CONNECTION,
      action: CONNECTION_ACTION.PING
    })
  }

  /**
   * Initialize the ws endpoint, setup callbacks etc.
   */
  public createWebsocketServer () {
    this.server = new WebSocket.Server({ noServer: true })
    this.services.httpService.registerWSUpgradePath(this.wsOptions.urlPath, this.server)
    this.server.on('connection', (websocket, handshakeData: SocketHandshakeData) => {
      const socketWrapper = this.createWebsocketWrapper(websocket, handshakeData)
      this.sendPing(socketWrapper)

      this.connections.set(websocket, socketWrapper)

      websocket.on('close', () => {
        this.onSocketClose(this.connections.get(websocket))
        this.connections.delete(websocket)
      })

      websocket.on('message', (msg: string) => {
        const messages = textMessageParser.parse(msg)
        if (messages.length > 0) {
          this.connections.get(websocket)!.onMessage(messages)
        }
      })

      this.onConnection(socketWrapper)

      socketWrapper.onMessage = socketWrapper.authCallback!
      socketWrapper.sendMessage({
        topic: TOPIC.CONNECTION,
        action: CONNECTION_ACTION.ACCEPT
      }, false)
    })

    return this.server
  }

  private sendPing (socketWrapper: UnauthenticatedSocketWrapper) {
    if (!socketWrapper.isClosed) {
      socketWrapper.sendBuiltMessage!(this.pingMessage)
      setTimeout(this.sendPing.bind(this, socketWrapper), this.wsOptions.heartbeatInterval)
    }
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
