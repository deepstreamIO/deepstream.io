import ConnectionEndpoint, {WebSocketServerConfig} from '../websocket/connection-endpoint'
import { STATES } from '../../constants'
import * as fileUtils from '../../config/file-utils'
import * as binaryMessageParser from '../../../binary-protocol/src/message-parser'
import {createUWSSocketWrapper} from './socket-wrapper-factory'
import { DeepstreamServices, SocketWrapper, InternalDeepstreamConfig, UnauthenticatedSocketWrapper } from '../../types'
import { WebSocket, TemplatedApp as Server, us_listen_socket, HttpRequest } from 'uWebSockets.js'
import { Dictionary } from 'ts-essentials'

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export default class UWSConnectionEndpoint extends ConnectionEndpoint {
  private listenSocket: null | us_listen_socket
  private readonly uWS: any
  private connections = new Map<WebSocket, UnauthenticatedSocketWrapper>()

  constructor (options: WebSocketServerConfig, config: InternalDeepstreamConfig, services: DeepstreamServices) {
    super(options, config, services)

    // alias require to trick nexe from bundling it
    const req = require
    try {
      this.uWS = req('uWebSockets.js')
    } catch (e) {
      this.uWS = req(fileUtils.lookupLibRequirePath('uWebSockets.js'))
    }

    this.description = 'µWebSocket Connection Endpoint'
    this.onMessages = this.onMessages.bind(this)
    this.listenSocket = null
  }

  /**
   * Initialize the uws endpoint, setup callbacks etc.
   */
  public createWebsocketServer () {
    const options = {
      noDelay: this.getOption('noDelay'),
      perMessageDeflate: this.getOption('perMessageDeflate'),
      maxPayload: this.getOption('maxMessageSize')
    }

    const server = UWSConnectionEndpoint.getServer(this.uWS, {
      sslCert: this.getOption('sslCert'),
      sslKey: this.getOption('sslKey'),
      sslDHParams: this.getOption('sslDHParams'),
      sslPassphrase: this.getOption('sslPassphrase')
    }, options)

    server.get(this.getOption('healthCheckPath'), (res) => {
      res.end()
    })

    server.ws(this.getOption('urlPath'), {
      /* Options */
      compression: 0,
      maxPayloadLength: this.getOption('maxMessageSize'),
      idleTimeout: this.getOption('heartbeatInterval') * 2,
      /* Handlers */
      open: (ws, request) => {
        const socketWrapper = this.createWebsocketWrapper(ws, request)
        this.connections.set(ws, socketWrapper)
        this.onConnection(socketWrapper)
      },
      message: (ws, message) => {
        this.connections.get(ws)!.onMessage(
          binaryMessageParser.parse(Buffer.from(message.slice(0))
        ))
      },
      drain: () => {
      },
      close: (ws) => {
        this.onSocketClose(this.connections.get(ws))
        this.connections.delete(ws)
      }
    })

    server.listen(this.getOption('host'), this.getOption('port'), (token) => {
      /* Save the listen socket for later shut down */
      this.listenSocket = token

      if (token) {
        this.onReady()
      } else {
        this.logger.error(
            STATES[STATES.SERVICE_INIT],
            `Failed to listen to port ${this.getOption('port')}`
        )
      }
    })

    return server
  }

  /**
   * Returns sslKey, sslCert and other options from the config.
   */
  public static getSLLParams (config: Partial<InternalDeepstreamConfig>) {
    const keyFileName = config.sslKey
    const certFileName = config.sslCert
    const dhParamsFile = config.sslDHParams
    const passphrase = config.sslPassphrase
    if (keyFileName || certFileName) {
      if (!keyFileName) {
        throw new Error('Must also include sslKey in order to use SSL')
      }
      if (!certFileName) {
        throw new Error('Must also include sslCertFile in order to use SSL')
      }

      return {
        key_file_name: keyFileName,
        cert_file_name: certFileName,
        passphrase,
        dh_params_file_name: dhParamsFile
      }
    }
    return null
  }

  public static getServer (uWS: any, config: Partial<InternalDeepstreamConfig>, options: any): Server {
    let server
    const sslParams = UWSConnectionEndpoint.getSLLParams(config)
    if (sslParams) {
      server = new uWS.SSLApp({
        ...options,
        ...sslParams
      })
    } else {
      server = new uWS.App(options)
    }
    return server
  }

  public static getHeaders (desiredHeaders: string[], req: HttpRequest) {
    const headers: Dictionary<string> = {}
    for (const wantedHeader of desiredHeaders) {
      headers[wantedHeader] = req.getHeader(wantedHeader)
    }
    return headers
  }

  public closeWebsocketServer () {
    this.connections.forEach((conn) => {
      if (!conn.isClosed) {
        conn.close()
      }
    })
    this.uWS.us_listen_socket_close(this.listenSocket)
    this.connections.clear()
    setTimeout(() => this.emit('close'), 2000)
  }

  /**
   * Receives a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user
   * and subscribes to authentication messages.
   */
  public createWebsocketWrapper (websocket: WebSocket, upgradeReq: HttpRequest): UnauthenticatedSocketWrapper {
    const handshakeData = {
      remoteAddress: new Uint8Array(websocket.getRemoteAddress()).join('.'),
      headers: UWSConnectionEndpoint.getHeaders(this.options.headers, upgradeReq),
      referer: upgradeReq.getHeader('referer')
    }
    const socketWrapper = createUWSSocketWrapper(
        websocket, handshakeData, this.services, this.options, this
    )
    return socketWrapper
  }

  public onSocketWrapperClosed (socketWrapper: SocketWrapper) {
    socketWrapper.close()
  }
}
