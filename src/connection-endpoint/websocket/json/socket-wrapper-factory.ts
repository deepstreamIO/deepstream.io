import { ParseResult, Message } from '../../../constants'
import { WebSocketServerConfig } from '../../base/connection-endpoint'
import { SocketConnectionEndpoint, DeepstreamServices } from '@deepstream/types'
import { WSSocketWrapper } from '../../base/socket-wrapper'

export class JSONSocketWrapper extends WSSocketWrapper<string> {
  public socketType = 'wsJSON'

  public getMessage (message: Message): string {
    return JSON.stringify(message)
  }

  public getAckMessage (message: Message): string {
    return this.getMessage(message)
  }

  public parseMessage (message: string): ParseResult[] {
    if (typeof message !== 'string') {
      this.invalidTypeReceived()
      return []
    }

    try {
      return [JSON.parse(message)]
    } catch (e) {
      this.invalidTypeReceived()
      return []
    }
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
) { return new JSONSocketWrapper(socket, handshakeData, services, config, connectionEndpoint, false) }
