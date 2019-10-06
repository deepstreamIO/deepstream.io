import { ParseResult, Message } from '../../constants'
import { WebSocketServerConfig } from '../base-websocket/connection-endpoint'
import { SocketConnectionEndpoint, DeepstreamServices } from '../../../ds-types/src/index'
import { WSSocketWrapper } from '../base-websocket/socket-wrapper'

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 */
export class JSONSocketWrapper extends WSSocketWrapper<string> {
  public getMessage (message: Message): string {
    return JSON.stringify(message)
  }

  public getAckMessage (message: Message): string {
    return this.getMessage(message)
  }

  public parseMessage (message: string): ParseResult[] {
    return [JSON.parse(message)]
  }

  public parseData (message: Message): true | Error {
    try {
      if (message.data) {
        message.parsedData = JSON.parse(message.data as string)
      }
      return true
    } catch (e) {
      return e
    }
  }
}

export const createWSSocketWrapper = function (
  socket: any,
  handshakeData: any,
  services: DeepstreamServices,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint
) { return new JSONSocketWrapper(socket, handshakeData, services, config, connectionEndpoint) }
