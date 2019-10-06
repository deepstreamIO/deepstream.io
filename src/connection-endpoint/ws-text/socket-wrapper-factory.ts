import { ParseResult, Message } from '../../constants'
import * as textMessageBuilder from './protocol/message-builder'
import * as textMessageParse from './protocol/message-parser'
import { SocketConnectionEndpoint, DeepstreamServices } from '../../../ds-types/src/index'
import { WebSocketServerConfig } from '../base-websocket/connection-endpoint'
import { WSSocketWrapper } from '../base-websocket/socket-wrapper'

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 */
export class TextWSSocketWrapper extends WSSocketWrapper<string> {
  public getMessage (message: Message): string {
    return textMessageBuilder.getMessage(message, false)
  }

  public getAckMessage (message: Message): string {
    return textMessageBuilder.getMessage(message, true)
  }

  public parseMessage (message: string): ParseResult[] {
    return textMessageParse.parse(message)
  }

  public parseData (message: Message): true | Error {
    return textMessageParse.parseData(message)
  }
}

export const createWSSocketWrapper = function (
  socket: any,
  handshakeData: any,
  services: DeepstreamServices,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint,
) { return new TextWSSocketWrapper(socket, handshakeData, services, config, connectionEndpoint) }