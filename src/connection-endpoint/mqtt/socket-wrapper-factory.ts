import { StatefulSocketWrapper, DeepstreamServices, UnauthenticatedSocketWrapper, EVENT, NamespacedLogger } from '@deepstream/types'
import { TOPIC, CONNECTION_ACTION, Message, EVENT_ACTION, AUTH_ACTION, RECORD_ACTION, ParseResult } from '../../constants'
import { ACTIONS_BYTE_TO_KEY } from '../websocket/text/text-protocol/constants'
import { parseMQTT } from './message-parser'

/**
 * This class wraps around a websocket
 * and provides higher level methods that are integrated
 * with deepstream's message structure
 */
export class MQTTSocketWrapper implements UnauthenticatedSocketWrapper {
  public socketType = 'mqtt'
  public userId: string | null = null
  public serverData: object | null = null
  public clientData: object | null = null

  public isRemote: false = false
  public isClosed: boolean = false
  public uuid: number = Math.random()
  public authCallback: Function | null = null
  public authAttempts: number = 0

  private closeCallbacks: Set<Function> = new Set()

  constructor (
    private socket: any,
    private handshakeData: any,
    private services: DeepstreamServices,
    private logger: NamespacedLogger
   ) {
  }

  get isOpen () {
    return this.isClosed !== true
  }

  public flush () {
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendMessage (message: { topic: TOPIC, action: CONNECTION_ACTION } | Message, allowBuffering: boolean = true): void {
    this.services.monitoring.onMessageSend(message)
    this.sendBuiltMessage(message)
  }

  /**
   * Sends a message based on the provided action and topic
   */
  public sendAckMessage (message: Message, allowBuffering: boolean = true): void {
    this.services.monitoring.onMessageSend(message)
    if (message.topic === TOPIC.EVENT) {
      if (message.action === EVENT_ACTION.SUBSCRIBE) {
        this.socket.suback({ granted: [0], messageId: Number(message.correlationId) })
        return
      }
    }
    if (message.topic === TOPIC.RECORD) {
      if (message.action === RECORD_ACTION.SUBSCRIBE) {
        this.socket.suback({ granted: [1], messageId: Number(message.correlationId) })
        return
      }
    }
    this.logger.warn(EVENT.UNKNOWN_ACTION, `Unhandled ack message for ${TOPIC[message.topic]}:${ACTIONS_BYTE_TO_KEY[message.topic][message.action]}`)
  }

  public getMessage (message: Message): Message {
    return message
  }

  public parseData (message: Message): true | Error {
    return true
  }

  public onMessage (messages: Message[]): void {
  }

  /**
   * Destroys the socket. Removes all deepstream specific
   * logic and closes the connection
   */
  public destroy (): void {
    this.socket.destroy()
  }

  public close (): void {
    this.isClosed = true
    this.authCallback = null

    this.closeCallbacks.forEach((cb) => cb(this))
    this.services.logger.info(EVENT.CLIENT_DISCONNECTED, this.userId!)
  }

  public parseMessage (serializedMessage: any): ParseResult[] {
    return parseMQTT(serializedMessage)
  }

  /**
   * Returns a map of parameters that were collected
   * during the initial http request that established the
   * connection
   */
  public getHandshakeData (): any {
    return this.handshakeData
  }

  public onClose (callback: (socketWrapper: StatefulSocketWrapper) => void): void {
    this.closeCallbacks.add(callback)
  }

  public removeOnClose (callback: (socketWrapper: StatefulSocketWrapper) => void): void {
    this.closeCallbacks.delete(callback)
  }

  public sendBuiltMessage (message: Message, buffer?: boolean): void {
    if (this.isOpen) {
        if (message.topic === TOPIC.CONNECTION) {
          if (message.action === CONNECTION_ACTION.ACCEPT) {
            return
          }
        }

        if (message.topic === TOPIC.AUTH) {
          if (message.action === AUTH_ACTION.AUTH_SUCCESSFUL) {
            this.socket.connack({ returnCode: 0 })
            return
          }
          if (message.action === AUTH_ACTION.AUTH_UNSUCCESSFUL) {
            this.socket.connack({ returnCode: 5, reason: message.reason })
            return
          }
        }

        if (message.topic === TOPIC.EVENT) {
          if (message.action === EVENT_ACTION.EMIT) {
            let payload = message.data
            if (!payload && message.parsedData) {
              payload = Buffer.from(JSON.stringify(message.parsedData))
            }
            this.socket.publish({
              cmd: 'publish',
              topic: message.name,
              payload,
              length: payload && payload.length
            })
            return
          }
        }

        if (message.topic === TOPIC.RECORD) {
          if (message.action === RECORD_ACTION.WRITE_ACKNOWLEDGEMENT) {
            this.socket.puback({ messageId: message.correlationId })
            return
          }

          if (message.action === RECORD_ACTION.UPDATE) {
            const payload = Buffer.from(JSON.stringify(message.parsedData))
            this.socket.publish({
              cmd: 'publish',
              topic: message.name,
              payload,
              length: payload.length
            })
            return
          }

          if (message.action === RECORD_ACTION.PATCH) {
            this.logger.warn(EVENT.UNSUPPORTED_ACTION, 'Patches are not currently supported via the MQTT API')
            return
          }
        }

        this.logger.warn(EVENT.UNKNOWN_ACTION, `Unhandled message for ${TOPIC[message.topic]}:${ACTIONS_BYTE_TO_KEY[message.topic][message.action]}`)
    }
  }
}

export const createMQTTSocketWrapper = function (
  socket: any,
  handshakeData: any,
  services: DeepstreamServices,
  logger: NamespacedLogger
) { return new MQTTSocketWrapper(socket, handshakeData, services, logger) }
