import ConnectionEndpoint, {WebSocketServerConfig} from '../websocket/connection-endpoint'
import {
  TOPIC,
  CONNECTION_ACTIONS,
  STATES
} from '../../constants'
import * as fileUtils from '../../config/file-utils'
import * as binaryMessageBuilder from '../../../binary-protocol/src/message-builder'
import * as binaryMessageParser from '../../../binary-protocol/src/message-parser'
import {createUWSSocketWrapper} from './socket-wrapper-factory'
import {isIterable} from "../../utils/utils";

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export default class UWSConnectionEndpoint extends ConnectionEndpoint {
  private listenSocket: null
  private uWS: any
  private connections: Map<any, any>
  private pingInterval: any

  constructor (options: WebSocketServerConfig, services: DeepstreamServices) {
    super(options, services)

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
   *
   * @private
   * @returns {void}
   */
  public createWebsocketServer () {
    this.connections = new Map()

    const options = {
      noDelay: this.getOption('noDelay'),
      perMessageDeflate: this.getOption('perMessageDeflate'),
      maxPayload: this.getOption('maxMessageSize')
    }

    const server = UWSConnectionEndpoint.getServer(this.uWS, {
      sslCert: this.getOption('sslCert'),
      sslKey: this.getOption('sslKey'),
      sslDHParams: this.getOption('sslDHParams'),
      passphrase: this.getOption('sslPassphrase')
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
        this.connections.get(ws).onMessage(binaryMessageParser.parse(Buffer.from(message.slice())))
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

        const pingMessage = binaryMessageBuilder.getMessage({ topic: TOPIC.CONNECTION, action: CONNECTION_ACTIONS.PING }, false)
        this.pingInterval = setInterval(() => {
          this.connections.forEach((con) => {
            if (!con.isClosed) {
              con.sendBinaryMessage!(pingMessage)
            }
          })
        }, this.getOption('heartbeatInterval'))
      } else {
        this.logger.error(
            STATES.SERVICE_INIT,
            `Failed to listen to port ${this.getOption('port')}`
        )
      }
    })

    return server
  }

  /**
   * Returns sslKey, sslCert and other options from the config.
   *
   * @throws Will throw an error if one of sslKey or sslCert are not specified
   *
   * @private
   * @returns {null|Object} {
   *   {String}           key   ssl key
   *   {String}           cert  ssl certificate
   *   {String|undefined} ca    ssl certificate authority (if it's present in options)
   * }
   */
  public static getSLLParams (config) {
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

  public static getServer (uWS, config, options) {
    let server
    const sslParams = UWSConnectionEndpoint.getSLLParams(config)
    if (sslParams) {
      server = new uWS.SSLApp(Object.assign(
          {},
          options,
          sslParams
      ))
    } else {
      server = new uWS.App(options)
    }
    return server
  }

  public static getHeaders (desiredHeaders, req) {
    const headers = {}
    if (!isIterable(desiredHeaders)) return headers
    for (const wantedHeader of desiredHeaders) {
      headers[wantedHeader] = req.getHeader(wantedHeader)
    }
    return headers
  }

  public closeWebsocketServer () {
    this.connections.forEach((conn) => {
      if (!conn.isClosed) {
        conn.socket.close()
      }
    })
    this.uWS.us_listen_socket_close(this.listenSocket)
    this.connections.clear()
    clearInterval(this.pingInterval)
    setTimeout(() => this.emit('close'), 2000)
  }

  /**
   * Receives a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user
   * and subscribes to authentication messages.
   * @param {Websocket} socket
   *
   * @param {WebSocket} external    uws native websocket
   *
   * @private
   * @returns {void}
   */
  public createWebsocketWrapper (websocket, upgradeReq): SocketWrapper {
    const handshakeData = {
      remoteAddress: new Uint8Array(websocket.getRemoteAddress()).join('.'),
      headers: UWSConnectionEndpoint.getHeaders(this.options.headers, upgradeReq),
      referer: upgradeReq.getHeader('referer')
    }
    const socketWrapper = createUWSSocketWrapper(
        websocket, handshakeData, this.logger, this.options, this
    )
    return socketWrapper
  }

  public onSocketWrapperClosed (socketWrapper) {
    socketWrapper.close()
  }
}
