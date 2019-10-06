import { ParseResult, Message } from '../../constants'
import * as binaryMessageBuilder from '@deepstream/protobuf/dist/src/message-builder'
import * as binaryMessageParser from '@deepstream/protobuf/dist/src/message-parser'
import { WebSocketServerConfig } from '../base-websocket/connection-endpoint'
import { SocketConnectionEndpoint, DeepstreamServices } from '../../../ds-types/src/index'
import { WSSocketWrapper } from '../base-websocket/socket-wrapper'

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 */
export class WSBinarySocketWrapper extends WSSocketWrapper<Uint8Array> {
  public getAckMessage (message: Message): Uint8Array {
    return binaryMessageBuilder.getMessage(message, true)
  }

  public getMessage (message: Message): Uint8Array {
    return binaryMessageBuilder.getMessage(message, false)
  }

  public parseMessage (message: ArrayBuffer): ParseResult[] {
    /* we copy the underlying buffer (since a shallow reference won't be safe
     * outside of the callback)
     * the copy could be avoided if we make sure not to store references to the
     * raw buffer within the message
     */
    return binaryMessageParser.parse(Buffer.from(Buffer.from(message)))
  }

  public parseData (message: Message): true | Error {
    return binaryMessageParser.parseData(message)
  }
}

export const createWSSocketWrapper = function (
  socket: any,
  handshakeData: any,
  services: DeepstreamServices,
  config: WebSocketServerConfig,
  connectionEndpoint: SocketConnectionEndpoint
) { return new WSBinarySocketWrapper(socket, handshakeData, services, config, connectionEndpoint) }
