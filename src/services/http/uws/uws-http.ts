import { DeepstreamPlugin, DeepstreamHTTPService, PostRequestHandler, GetRequestHandler, DeepstreamServices, DeepstreamConfig, SocketWrapper, WebSocketConnectionEndpoint, SocketWrapperFactory } from '../../../../ds-types/src/index'
// import * as HTTPStatus from 'http-status'
import { Dictionary } from 'ts-essentials'
import * as uws from 'uWebSockets.js'
import { STATES } from '../../../constants'
import { PromiseDelay } from '../../../utils/utils'
import * as fileUtils from '../../../config/file-utils'
import * as HTTPStatus from 'http-status'

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

  public registerPostPathPrefix<DataInterface> (prefix: string, handler: PostRequestHandler<any>) {
    this.server.post(prefix, (response: uws.HttpResponse, request: uws.HttpRequest) => {
      /* Register error cb */
      response.onAborted((err) => {
        console.log('error with post', err)
      })

      const meta = { headers: this.getHeaders(request), url: request.getUrl() }

      readJson(response, (body: any) => {
        handler(
          body,
          meta,
          this.sendResponse.bind(this, response)
        )
      }, () => {
        this.terminateResponse(
          response,
          HTTPStatus.BAD_REQUEST,
          'Failed to parse body of request'
        )
      })
    })
  }

  public registerGetPathPrefix (prefix: string, handler: GetRequestHandler) {
    this.server.get(prefix, (response: uws.HttpResponse, request: uws.HttpRequest) => {
      /* Register error cb */
      response.onAborted((err) => {
        console.log('error with get', err)
      })

      handler(
        { headers: this.getHeaders(request), url: request.getUrl() },
        this.sendResponse.bind(this, response)
      )
    })
  }

  public sendWebsocketMessage (socket: uws.WebSocket, message: Uint8Array | string, isBinary: boolean) {
    socket.send(message, isBinary)
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
          headers: this.getHeaders(request),
          referer: request.getHeader('referer')
        }
        const socketWrapper = createSocketWrapper(websocket, handshakeData, this.services, webSocketConnectionEndpoint.wsOptions, webSocketConnectionEndpoint)
        this.connections.set(websocket, socketWrapper)
        webSocketConnectionEndpoint.onConnection.call(webSocketConnectionEndpoint, socketWrapper)
      },
      message: (ws: uws.WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        const socketWrapper = this.connections.get(ws)!
        const messages = socketWrapper.parseMessage(isBinary ? new Uint8Array(message) : Buffer.from(message).toString())
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

  private terminateResponse (response: uws.HttpResponse, code: number, message?: string) {
    response.writeHeader('Content-Type', 'text/plain; charset=utf-8')
    response.writeStatus(code.toString())
    if (message) {
      response.end(`${message}\r\n\r\n`)
    } else {
      response.end()
    }
  }

  private sendResponse (
    response: uws.HttpResponse,
    err: { statusCode: number, message: string } | null,
    data: { result: string, body: object }
  ): void {
    if (err) {
      const statusCode = err.statusCode || HTTPStatus.BAD_REQUEST
      this.terminateResponse(response, statusCode, err.message)
      return
    }
    response.writeHeader('Content-Type', 'application/json; charset=utf-8')
    response.writeStatus(HTTPStatus.OK.toString())
    if (data) {
      response.end(`${JSON.stringify(data)}\r\n\r\n`)
    } else {
      response.end()
    }
  }

  public getHeaders (req: uws.HttpRequest) {
    const headers: Dictionary<string> = {}
    for (const wantedHeader of this.pluginOptions.headers) {
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

/* Helper function for reading a posted JSON body */
function readJson (res: uws.HttpResponse, cb: Function, err: (res: uws.HttpResponse) => void) {
  let buffer: Buffer

  res.onData((ab, isLast) => {
    const chunk = Buffer.from(ab)
    if (isLast) {
      let json
      if (buffer) {
        try {
          json = JSON.parse(Buffer.concat([buffer, chunk]).toString())
        } catch (e) {
          /* res.close calls onAborted */
          res.close()
          return
        }
        cb(json)
      } else {
        try {
          json = JSON.parse(chunk.toString())
        } catch (e) {
          /* res.close calls onAborted */
          res.close()
          return
        }
        cb(json)
      }
    } else {
      if (buffer) {
        buffer = Buffer.concat([buffer, chunk])
      } else {
        buffer = Buffer.concat([chunk])
      }
    }
  })
}
