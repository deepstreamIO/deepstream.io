import { DeepstreamPlugin, DeepstreamHTTPService, PostRequestHandler, GetRequestHandler, DeepstreamServices, DeepstreamConfig, SocketWrapper, WebSocketConnectionEndpoint, SocketWrapperFactory } from '../../../../ds-types/src/index'
// import * as HTTPStatus from 'http-status'
import { Dictionary } from 'ts-essentials'
import * as uws from 'uWebSockets.js'
import { STATES, TOPIC } from '../../../constants'
import { PromiseDelay } from '../../../utils/utils'
import * as fileUtils from '../../../config/file-utils'

interface UWSHTTPInterface extends uws.AppOptions {
    healthCheckPath: string,
    host: string,
    port: number,
    allowAllOrigins: boolean,
    origins?: string[],
    maxMessageSize: number,
    hostUrl: string,
    headers: string[],
}

export class UWSHTTP extends DeepstreamPlugin implements DeepstreamHTTPService {
  public description: string = 'UWS HTTP Service'
  private server!: uws.TemplatedApp
  private isReady: boolean = false
  private uWS: typeof uws
  private connections = new Map<uws.WebSocket, SocketWrapper>()
  private listenSocket!: uws.us_listen_socket
  private isGettingReady: boolean = false

  constructor (private pluginOptions: UWSHTTPInterface, private services: DeepstreamServices, config: DeepstreamConfig) {
    super()

    // alias require to trick nexe from bundling it
    const req = require
    try {
      this.uWS = req('uWebSockets.js')
    } catch (e) {
      this.uWS = req(fileUtils.lookupLibRequirePath('uWebSockets.js'))
    }

    const sslParams = this.getSLLParams(pluginOptions)
    if (sslParams) {
      this.server = uws.SSLApp({
        ...pluginOptions,
        ...sslParams
      })
    } else {
      this.server = uws.App(pluginOptions)
    }
  }

  public async whenReady (): Promise<void> {
    if (this.isReady || this.isGettingReady) {
        return
    }
    this.isGettingReady = true
    return new Promise((resolve) => {
      this.server.listen(this.pluginOptions.host, this.pluginOptions.port, (token) => {
        /* Save the listen socket for later shut down */
        this.listenSocket = token

        if (!!token) {
          resolve()
          return
        }

        this.services.logger.fatal(
          STATES.SERVICE_INIT,
          `Failed to listen to port: ${this.pluginOptions.port}`
        )
      })
    })
  }

  public async close (): Promise<void> {
    const closePromises: Array<Promise<void>> = []
    this.connections.forEach((conn) => {
      if (!conn.isClosed) {
        closePromises.push(new Promise((resolve) => conn.onClose(resolve)))
        conn.destroy()
      }
    })
    await Promise.all(closePromises)
    this.connections.clear()
    this.uWS.us_listen_socket_close(this.listenSocket)
    await PromiseDelay(2000)
  }

  public registerPostPathPrefix<DataInterface> (prefix: string, handler: PostRequestHandler<DataInterface>) {
  }

  public registerGetPathPrefix (prefix: string, handler: GetRequestHandler) {
  }

  public registerWebsocketEndpoint (path: string, createSocketWrapper: SocketWrapperFactory, webSocketConnectionEndpoint: WebSocketConnectionEndpoint) {
    this.server.ws(path, {
      /* Options */
      compression: 0,
      maxPayloadLength: webSocketConnectionEndpoint.wsOptions.maxMessageSize,
      idleTimeout: webSocketConnectionEndpoint.wsOptions.heartBeatInterval * 2,
      open: (websocket: uws.WebSocket, request: uws.HttpRequest) => {
        const handshakeData = {
          remoteAddress: new Uint8Array(websocket.getRemoteAddress()).join('.'),
          headers: this.getHeaders(webSocketConnectionEndpoint.wsOptions.headers, request),
          referer: request.getHeader('referer')
        }
        const socketWrapper = createSocketWrapper(websocket, handshakeData, this.services, webSocketConnectionEndpoint.wsOptions, webSocketConnectionEndpoint)
        this.connections.set(websocket, socketWrapper)
        webSocketConnectionEndpoint.onConnection.call(webSocketConnectionEndpoint, socketWrapper)
      },
      message: (ws: uws.WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        const socketWrapper = this.connections.get(ws)!
        const messages = socketWrapper.parseMessage(new Uint8Array(message))
        if (messages.length > 0) {
          socketWrapper.onMessage(messages)
        }
      },
      drain: () => {
      },
      close: (ws: uws.WebSocket) => {
        webSocketConnectionEndpoint.onSocketClose.call(webSocketConnectionEndpoint, this.connections.get(ws)!)
        this.connections.delete(ws)
      }
    })
  }

  // private handlePost (request: uws.HttpRequest, response: uws.HttpResponse): void {
  // }

  // private handleGet (request: uws.HttpRequest, response: uws.HttpResponse) {
  // }

  // private terminateResponse (response: uws.HttpResponse, code: number, message?: string) {
  //   response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  //   response.writeHead(code)
  //   if (message) {
  //     response.end(`${message}\r\n\r\n`)
  //   } else {
  //     response.end()
  //   }
  // }

  // private sendResponse (
  //   response: uws.HttpResponse,
  //   err: { statusCode: number, message: string } | null,
  //   data: { result: string, body: object }
  // ): void {
  //   if (err) {
  //     const statusCode = err.statusCode || HTTPStatus.BAD_REQUEST
  //     this.terminateResponse(response, statusCode, err.message)
  //     return
  //   }
  //   response.setHeader('Content-Type', 'application/json; charset=utf-8')
  //   response.writeHead(HTTPStatus.OK)
  //   if (data) {
  //     response.end(`${JSON.stringify(data)}\r\n\r\n`)
  //   } else {
  //     response.end()
  //   }
  // }

  public getHeaders (desiredHeaders: string[] = [], req: uws.HttpRequest) {
    const headers: Dictionary<string> = {}
    for (const wantedHeader of desiredHeaders) {
      headers[wantedHeader] = req.getHeader(wantedHeader).toString()
    }
    return headers
  }

  private getSLLParams (options: any) {
    const keyFileName = options.keyFileName
    const certFileName = options.certFileName
    const dhParamsFile = options.sslDHParams
    const passphrase = options.sslPassphrase
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

}
