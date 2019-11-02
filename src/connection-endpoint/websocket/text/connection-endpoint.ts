import { WebSocketServerConfig } from '../../base/connection-endpoint'
import BaseWebsocketConnectionEndpoint from '../../base/connection-endpoint'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, DeepstreamConfig, UnauthenticatedSocketWrapper, WebSocketConnectionEndpoint } from '@deepstream/types'
import * as textMessageBuilder from './text-protocol/message-builder'
import { TOPIC, CONNECTION_ACTION } from '../../../constants'

export class WSTextConnectionEndpoint extends BaseWebsocketConnectionEndpoint implements WebSocketConnectionEndpoint {
  public description = 'WS Text Protocol Connection Endpoint'
  private pingMessage: string

  constructor (public wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)

    this.pingMessage = textMessageBuilder.getMessage({
      topic: TOPIC.CONNECTION,
      action: CONNECTION_ACTION.PING
    })
  }

  public async init () {
    super.init()
    this.services.httpService.registerWebsocketEndpoint(this.wsOptions.urlPath, createWSSocketWrapper, this)
  }

  public onConnection (socketWrapper: UnauthenticatedSocketWrapper) {
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
      setTimeout(this.sendPing.bind(this, socketWrapper), this.wsOptions.heartbeatInterval)
    }
  }
}
