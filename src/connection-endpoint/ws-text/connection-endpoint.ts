import {WebSocketServerConfig} from '../base-websocket/connection-endpoint'
import * as textMessageBuilder from './protocol/message-builder'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, SocketWrapper, DeepstreamConfig, UnauthenticatedSocketWrapper } from '../../../ds-types/src/index'
import { TOPIC, CONNECTION_ACTION } from '../../constants'
import { BaseWSConnectionEndpoint } from '../ws-base/connection-endpoint'

interface WSConnectionEndpointConfig extends WebSocketServerConfig {
  heartbeatInterval: number
}

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class WSTextConnectionEndpoint extends BaseWSConnectionEndpoint<WSConnectionEndpointConfig> {
  public description = 'WS Text Protocol Connection Endpoint'

  private pingMessage: string

  constructor (private wsTextOptions: WSConnectionEndpointConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsTextOptions, services, config, createWSSocketWrapper)
    this.pingMessage = textMessageBuilder.getMessage({
      topic: TOPIC.CONNECTION,
      action: CONNECTION_ACTION.PING
    })
  }

  public onConnection (socketWrapper: SocketWrapper) {
    super.onConnection(socketWrapper)
    socketWrapper.onMessage = socketWrapper.authCallback!
    socketWrapper.sendMessage({
      topic: TOPIC.CONNECTION,
      action: CONNECTION_ACTION.ACCEPT
    }, false)
    this.sendPing(socketWrapper)
  }

  private sendPing (socketWrapper: UnauthenticatedSocketWrapper) {
    if (!socketWrapper.isClosed) {
      socketWrapper.sendBuiltMessage!(this.pingMessage)
      setTimeout(this.sendPing.bind(this, socketWrapper), this.wsTextOptions.heartbeatInterval)
    }
  }
}
