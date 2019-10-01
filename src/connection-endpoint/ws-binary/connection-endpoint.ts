import { WebSocketServerConfig } from '../base-websocket/connection-endpoint'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, DeepstreamConfig } from '../../../ds-types/src/index'
import { BaseWSConnectionEndpoint } from '../ws-base/connection-endpoint'

/**
 * This is the front most class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class WSConnectionEndpoint extends BaseWSConnectionEndpoint<WebSocketServerConfig> {
  public description = 'WS Binary Connection Endpoint'
  constructor (wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config, createWSSocketWrapper)
  }
}
