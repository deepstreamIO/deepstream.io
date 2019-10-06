import BaseWebsocketConnectionEndpoint, { WebSocketServerConfig } from '../base-websocket/connection-endpoint'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, DeepstreamConfig, WebSocketConnectionEndpoint } from '../../../ds-types/src/index'

/**
 * This is the front most class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class WSConnectionEndpoint extends BaseWebsocketConnectionEndpoint implements WebSocketConnectionEndpoint {
  public description = 'WS Binary Connection Endpoint'
  constructor (public wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)
  }

  public async init () {
    super.init()
    this.services.httpService.registerWebsocketEndpoint(this.wsOptions.urlPath, createWSSocketWrapper, this)
  }
}
