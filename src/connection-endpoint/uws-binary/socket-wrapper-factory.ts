import { ParseResult, Message } from '../../constants'
import * as binaryMessageBuilder from '@deepstream/protobuf/dist/src/message-builder'
import * as binaryMessageParser from '@deepstream/protobuf/dist/src/message-parser'
import { WebSocketServerConfig } from '../base-websocket/connection-endpoint'
import { SocketConnectionEndpoint, DeepstreamServices } from '../../../ds-types/src/index'
import { WSSocketWrapper } from '../base-websocket/socket-wrapper'

export class UwsSocketWrapper extends WSSocketWrapper<Uint8Array> {
  public getMessage (message: Message): Uint8Array {
    return binaryMessageBuilder.getMessage(message, false)
  }

  public getAckMessage (message: Message): Uint8Array {
    return binaryMessageBuilder.getMessage(message, true)
  }

  public parseMessage (message: ArrayBuffer): ParseResult[] {
    return binaryMessageParser.parse(message as any)
  }

  public parseData (message: Message): true | Error {
    return binaryMessageParser.parseData(message)
  }

  protected writeMessage (socket: any, message: Uint8Array) {
    socket.send(message, true)
  }
}

export const createUWSSocketWrapper = function (
  socket: any,
  handshakeData: any,
  services: DeepstreamServices,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint
) { return new UwsSocketWrapper(socket, handshakeData, services, config, connectionEndpoint) }
