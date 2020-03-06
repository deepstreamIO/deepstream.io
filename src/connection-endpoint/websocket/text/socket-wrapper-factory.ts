import { ParseResult, Message } from '../../../constants'
import * as textMessageBuilder from './text-protocol/message-builder'
import * as textMessageParse from './text-protocol/message-parser'
import { SocketConnectionEndpoint, DeepstreamServices } from '@deepstream/types'
import { WebSocketServerConfig } from '../../base/connection-endpoint'
import { WSSocketWrapper } from '../../base/socket-wrapper'

export class TextWSSocketWrapper extends WSSocketWrapper<string> {
  public socketType = 'wsText'

  public getMessage (message: Message): string {
    return textMessageBuilder.getMessage(message, false)
  }

  public getAckMessage (message: Message): string {
    return textMessageBuilder.getMessage(message, true)
  }

  public parseMessage (message: string): ParseResult[] {
    if (typeof message !== 'string') {
      this.invalidTypeReceived()
      return []
    }

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
) { return new TextWSSocketWrapper(socket, handshakeData, services, config, connectionEndpoint, false) }
