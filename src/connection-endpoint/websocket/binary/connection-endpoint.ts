import BaseWebsocketConnectionEndpoint, { WebSocketServerConfig } from '../../base/connection-endpoint'
import { createWSSocketWrapper } from './socket-wrapper-factory'
import { DeepstreamServices, DeepstreamConfig, WebSocketConnectionEndpoint } from '../../../../ds-types/src/index'

export class WSBinaryConnectionEndpoint extends BaseWebsocketConnectionEndpoint implements WebSocketConnectionEndpoint {
  public description = 'Binary WebSocket Connection Endpoint'
  constructor (public wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)
  }

  public async init () {
    super.init()
    this.services.httpService.registerWebsocketEndpoint(this.wsOptions.urlPath, createWSSocketWrapper, this)
  }
}
