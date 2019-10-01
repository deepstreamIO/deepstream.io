import { createMQTTSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, SocketWrapper, DeepstreamConfig, UnauthenticatedSocketWrapper } from '../../../ds-types/src/index'
import ConnectionEndpoint, { WebSocketServerConfig } from '../base-websocket/connection-endpoint'

import { Server } from 'net'
// @ts-ignore
import * as mqttCon from 'mqtt-connection'
import { parseMQTT } from './message-parser'
import { TOPIC, CONNECTION_ACTION, AUTH_ACTION } from '../../constants'

export interface MQTTConnectionEndpointConfig extends WebSocketServerConfig {
  port: number,
  host: string,
  idleTimeout: number
}

type MQTTPacket = any
type MQTTConnection = any

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export class MQTTConnectionEndpoint extends ConnectionEndpoint {
  private server!: Server
  private connections = new Map<MQTTConnection, UnauthenticatedSocketWrapper>()
  private logger = this.services.logger.getNameSpace('MQTT')

  constructor (private mqttOptions: MQTTConnectionEndpointConfig, services: DeepstreamServices, config: DeepstreamConfig) {
    super(mqttOptions, services, config)
    this.description = 'MQTT Protocol Connection Endpoint'
    this.onMessages = this.onMessages.bind(this)
  }

  /**
   * Initialize the ws endpoint, setup callbacks etc.
   */
  public createWebsocketServer () {
    this.server = new Server()

    this.server.on('connection', (stream) => {
      const client: MQTTConnection = mqttCon(stream)
      const socketWrapper = createMQTTSocketWrapper(client, {}, this.services, this.logger)
      this.connections.set(client, socketWrapper)
      this.onConnection(socketWrapper)

      socketWrapper.onMessage([{
        topic: TOPIC.CONNECTION,
        action: CONNECTION_ACTION.CHALLENGE
      }])

      // client connected
      client.on('connect', function (packet: MQTTPacket) {
        socketWrapper.onMessage([{
          topic: TOPIC.AUTH,
          action: AUTH_ACTION.REQUEST,
          parsedData: {
            username: packet.username,
            password: packet.password && packet.password.toString()
          }
        }])
      })

      const closeClient = () => {
        if (!this.connections.has(client)) {
          return
        }
        this.onSocketClose(this.connections.get(client))
        this.connections.delete(client)

        socketWrapper.destroy()
      }

      // client disconnect
      client.on('disconnect', closeClient)

      // connection error handling
      client.on('close', closeClient)

      client.on('error', (e: any) => {
        console.log(e)
        this.logger.error('CLIENT ERROR', e.toString())
        closeClient()
      })

      // timeout idle streams after 5 minutes
      stream.setTimeout(this.mqttOptions.idleTimeout)

      // stream timeout
      stream.on('timeout', function () { client.destroy() })

      // client published
      client.on('publish', (packet: MQTTPacket) => {
        this.onMessages(socketWrapper as any, parseMQTT(packet))
      })

      // // client pinged
      client.on('pingreq', function () {
        client.pingresp()
      })

      // client subscribed
      client.on('subscribe', (packet: MQTTPacket) => {
        this.onMessages(socketWrapper as any, parseMQTT(packet))
      })

      // client subscribed
      client.on('unsubscribe', (packet: MQTTPacket) => {
        this.onMessages(socketWrapper as any, parseMQTT(packet))
      })
    })

    this.server.listen(this.mqttOptions.port, this.mqttOptions.host, this.onReady.bind(this))

    return this.server
  }

  public async closeWebsocketServer () {
    this.connections.forEach((conn) => {
      if (!conn.isClosed) {
        conn.destroy()
      }
    })
    this.connections.clear()
    return new Promise((resolve) => this.server.close(resolve))
  }

  public onSocketWrapperClosed (socketWrapper: SocketWrapper) {
    socketWrapper.close()
  }
}
