import WebsocketConnectionEndpoint, { WebSocketServerConfig } from '../../base/connection-endpoint'
import {createWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, DeepstreamConfig } from '@deepstream/types'

export class WSJSONConnectionEndpoint extends WebsocketConnectionEndpoint {
  public description = 'WS Text Connection Endpoint'
  constructor (public wsOptions: WebSocketServerConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(wsOptions, services, config)
  }

  public init () {
    super.init()
    this.services.httpService.registerWebsocketEndpoint(this.wsOptions.urlPath, createWSSocketWrapper, this)
  }
}
