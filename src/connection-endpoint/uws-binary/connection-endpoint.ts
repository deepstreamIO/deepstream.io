import ConnectionEndpoint, {WebSocketServerConfig} from '../base-websocket/connection-endpoint'
import { DeepstreamServices, DeepstreamConfig } from '../../../ds-types/src/index'
import { createUWSSocketWrapper } from './socket-wrapper-factory';

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class UWSConnectionEndpoint extends ConnectionEndpoint {
  constructor (public wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)

    this.description = 'µWebSocket Connection Endpoint'
    this.onMessages = this.onMessages.bind(this)
  }

  public async init () {
    super.init()
    this.services.httpService.registerWebsocketEndpoint(this.wsOptions.urlPath, createUWSSocketWrapper, this)
  }

}
