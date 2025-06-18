import { DeepstreamPlugin, DeepstreamHTTPService, PostRequestHandler, GetRequestHandler, DeepstreamServices, DeepstreamConfig, SocketWrapper, WebSocketConnectionEndpoint, SocketWrapperFactory, EVENT, DeepstreamHTTPMeta, DeepstreamHTTPResponse } from '@deepstream/types'
import { Dictionary } from 'ts-essentials'
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
  maxBackpressure?: number,
  headers: string[],
  hostUrl: string
}

interface UserData {
  url: string,
  headers: Dictionary<string>,
  referer: string
}

export class UWSHTTP extends DeepstreamPlugin implements DeepstreamHTTPService {
  public description: string = 'UWS HTTP Service'
  private server!: uws.TemplatedApp
  private isReady: boolean = false
  private uWS: typeof uws
  private connections = new Map<uws.WebSocket<UserData>, SocketWrapper>()
  private listenSocket!: uws.us_listen_socket
  private isGettingReady: boolean = false
  private maxBackpressure?: number = 1024 * 1024
  private methods: string[] = ['GET', 'POST', 'OPTIONS']
  private methodsStr: string = this.methods.join(', ')
  private headers: string[] = ['X-Requested-With', 'X-HTTP-Method-Override', 'Content-Type', 'Accept']
  private headersLower: string[] = this.headers.map((header) => header.toLowerCase())
  private headersStr: string = this.headers.join(', ')

  constructor (private pluginOptions: UWSHTTPInterface, private services: DeepstreamServices, config: DeepstreamConfig) {
    super()

    if (this.pluginOptions.allowAllOrigins === false) {
      if (this.pluginOptions.origins?.length === 0) {
        this.services.logger.fatal(EVENT.INVALID_CONFIG_DATA, 'HTTP allowAllOrigins set to false but no origins provided')
      }
    }
    // set maxBackpressure if defined, default is 1024*1024
    if (this.pluginOptions.maxBackpressure) {
      this.maxBackpressure = this.pluginOptions.maxBackpressure
    }

    // alias require to trick nexe from bundling it
    const req = require
    try {
      this.uWS = req('uWebSockets.js')
    } catch (e) {
      this.uWS = req(fileUtils.lookupLibRequirePath('uWebSockets.js'))
    }

    const sslParams = this.getSLLParams(pluginOptions)
    if (sslParams) {
      this.server = this.uWS.SSLApp({
        ...pluginOptions,
        ...sslParams
      })
    } else {
      this.server = this.uWS.App(pluginOptions)
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
        // handle options requests
        this.server.options('/*', (response: uws.HttpResponse, request: uws.HttpRequest) => {
          const baseHeaders: Dictionary<string> = {}
          if (!this.pluginOptions.allowAllOrigins) {
            const corsValidationHeaders = this.getVerifiedOriginHeaders(response, request)
            if (!corsValidationHeaders) { // Verification failed and response terminated
              return
            }
            Object.assign(baseHeaders, corsValidationHeaders)
            this.handleOptions(response, request, baseHeaders)
          } else {
            baseHeaders['Access-Control-Allow-Origin'] = '*'
            this.handleOptions(response, request, baseHeaders)
          }
        })

        // Health check path uses GET, so CORS headers will be applied by registerGetPathPrefix
        // The handler calls response(null), which will use sendResponse.
        // sendResponse will correctly order writeStatus and add Content-Type: application/json.
        this.registerGetPathPrefix(this.pluginOptions.healthCheckPath, (meta: DeepstreamHTTPMeta, response: DeepstreamHTTPResponse) => {
          response(null)
        })

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
      response.onAborted(() => {
        this.services.logger.warn(EVENT.ERROR, 'post request aborted')
      })

      const meta = { headers: this.getHeaders(request), url: request.getUrl() }

      const accumulatedHeaders: Dictionary<string> = {}

      if (!this.pluginOptions.allowAllOrigins) {
        const corsHeaders = this.getVerifiedOriginHeaders(response, request)
        if (!corsHeaders) {
          return // Response already terminated
        }
        Object.assign(accumulatedHeaders, corsHeaders)
      } else {
        accumulatedHeaders['Access-Control-Allow-Origin'] = '*'
      }

      readJson(response, (body: any) => {
        handler(
          body,
          meta,
          (err, data) => this.sendResponse(response, err, data, accumulatedHeaders)
        )
      }, (code: number) => {
        this.terminateResponse(
          response,
          code,
          HTTPStatus[`${code}_MESSAGE` as keyof typeof HTTPStatus] as string,
          accumulatedHeaders
        )
      }, this.pluginOptions.maxMessageSize)
    })
  }

  public registerGetPathPrefix (prefix: string, handler: GetRequestHandler) {
    this.server.get(prefix, (response: uws.HttpResponse, request: uws.HttpRequest) => {
      /* Register error cb */
      response.onAborted(() => {
        this.services.logger.warn(EVENT.ERROR, 'get request aborted')
      })

      const accumulatedHeaders: Dictionary<string> = {}

      if (!this.pluginOptions.allowAllOrigins) {
        const corsHeaders = this.getVerifiedOriginHeaders(response, request)
        if (!corsHeaders) {
          return // Response already terminated
        }
        Object.assign(accumulatedHeaders, corsHeaders)
      } else {
        accumulatedHeaders['Access-Control-Allow-Origin'] = '*'
      }

      handler(
        { headers: this.getHeaders(request), url: request.getUrl() },
        // Ensure the bound sendResponse uses these accumulatedHeaders
        (err, data) => this.sendResponse(response, err, data, accumulatedHeaders)
      )
    })
  }

  public sendWebsocketMessage (socket: uws.WebSocket<UserData>, message: Uint8Array | string, isBinary: boolean) {
    const sentStatus = socket.send(message, isBinary)
    if (sentStatus === 2) {
      // message was not sent
      const socketWrapper = this.connections.get(socket)!
      this.services.logger.error(EVENT.ERROR, `Failed to deliver message to userId ${socketWrapper.userId}, current socket backpressure ${socket.getBufferedAmount()}`)
    }
  }

  public getSocketWrappersForUserId (userId: string) {
    return [...this.connections.values()].filter((socketWrapper) => socketWrapper.userId === userId)
  }

  public registerWebsocketEndpoint (path: string, createSocketWrapper: SocketWrapperFactory, webSocketConnectionEndpoint: WebSocketConnectionEndpoint) {
    // uws idleTimeout is in seconds and requires it to be > 8
    const idleTimeout = webSocketConnectionEndpoint.wsOptions.heartbeatInterval * 2 / 1000 > 8 ? webSocketConnectionEndpoint.wsOptions.heartbeatInterval * 2 / 1000 : 8

    this.server.ws(path, {
      /* Options */
      compression: 0,
      /* Maximum length of received message. If a client tries to send you a message larger than this, the connection is immediately closed.*/
      maxPayloadLength: webSocketConnectionEndpoint.wsOptions.maxMessageSize,
      /* Maximum length of allowed backpressure per socket when sending messages. Slow receivers with too high backpressure will not receive messages */
      maxBackpressure: this.maxBackpressure,
      idleTimeout,
      upgrade: (response: uws.HttpResponse, request: uws.HttpRequest, context: any) => {
        /* This immediately calls open handler, you must not use response after this call */
        response.upgrade({
          url: request.getUrl(),
          headers: this.getHeaders(request),
          referer: request.getHeader('referer')
        },
          /* Spell these correctly */
          request.getHeader('sec-websocket-key'), request.getHeader('sec-websocket-protocol'), request.getHeader('sec-websocket-extensions'), context)
      },
      open: (websocket: uws.WebSocket<UserData>) => {
        const handshakeData = {
          remoteAddress: new Uint8Array(websocket.getRemoteAddress()).join('.'),
          headers: websocket.getUserData().headers,
          referer: websocket.getUserData().referer
        }
        const socketWrapper = createSocketWrapper(websocket, handshakeData, this.services, webSocketConnectionEndpoint.wsOptions, webSocketConnectionEndpoint)
        this.connections.set(websocket, socketWrapper)
        webSocketConnectionEndpoint.onConnection.call(webSocketConnectionEndpoint, socketWrapper)
      },
      message: (ws: uws.WebSocket<UserData>, message: ArrayBuffer, isBinary: boolean) => {
        const socketWrapper = this.connections.get(ws)!
        const messages = socketWrapper.parseMessage(isBinary ? new Uint8Array(message) : Buffer.from(message).toString())
        if (messages.length > 0) {
          socketWrapper.onMessage(messages)
        }
      },
      drain: (socket: uws.WebSocket<UserData>) => {
        const socketWrapper = this.connections.get(socket)!
        this.services.logger.warn(EVENT.INFO, `Socket backpressure drained for userId ${socketWrapper.userId}, current socket backpressure ${socket.getBufferedAmount()}`)
      },
      close: (ws: uws.WebSocket<UserData>) => {
        webSocketConnectionEndpoint.onSocketClose.call(webSocketConnectionEndpoint, this.connections.get(ws)!)
        this.connections.delete(ws)
      }
    } as any)
  }

  private terminateResponse (response: uws.HttpResponse, code: number, message?: string, additionalHeaders: Dictionary<string> = {}) {
    response.cork(() => {
      response.writeStatus(code.toString())
      for (const key in additionalHeaders) {
        if (additionalHeaders.hasOwnProperty(key)) {
          response.writeHeader(key, additionalHeaders[key])
        }
      }
      // Only set Content-Type if there's a message body, and not for 204/304
      if (message && code !== HTTPStatus.NO_CONTENT) {
        response.writeHeader('Content-Type', 'text/plain; charset=utf-8')
        response.end(`${message}\r\n\r\n`)
      } else {
        // For 204 NO_CONTENT or other cases without a message, just end.
        // uWS requires end() to be called.
        response.end()
      }
    })
  }

  private sendResponse (
    response: uws.HttpResponse,
    err: { statusCode: number, message: string } | null,
    data: { result: string, body: object },
    additionalHeaders: Dictionary<string> = {}
  ): void {
    if (err) {
      const statusCode = err.statusCode || HTTPStatus.BAD_REQUEST
      this.terminateResponse(response, statusCode, err.message, additionalHeaders)
      return
    }

    response.cork(() => {
      response.writeStatus(HTTPStatus.OK.toString())
      for (const key in additionalHeaders) {
        if (additionalHeaders.hasOwnProperty(key)) {
          response.writeHeader(key, additionalHeaders[key])
        }
      }
      response.writeHeader('Content-Type', 'application/json; charset=utf-8')
      if (data) {
        response.end(`${JSON.stringify(data)}\r\n\r\n`)
      } else {
        response.end()
      }
    })
  }
  public getHeaders (req: uws.HttpRequest) {
    const headers: Dictionary<string> = {}
    for (const wantedHeader of this.pluginOptions.headers) {
      headers[wantedHeader] = req.getHeader(wantedHeader).toString()
    }
    return headers
  }
  private getSLLParams (options: any) {
    if (!options.ssl) {
      return null
    }
    // tslint:disable-next-line: variable-name
    const { key: key_file_name, cert: cert_file_name, dhParams: dh_params_file_name, passphrase } = options.ssl
    if (key_file_name || cert_file_name) {
      if (!key_file_name) {
        this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'Must also include ssl key in order to use SSL')
      }
      if (!cert_file_name) {
        this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'Must also include ssl cert in order to use SSL')
      }
      return {
        key_file_name,
        cert_file_name,
        dh_params_file_name,
        passphrase,
      }
    }
    return null
  }

  // This method now either terminates the response or returns headers for the caller to use.
  private getVerifiedOriginHeaders (response: uws.HttpResponse, request: uws.HttpRequest): Dictionary<string> | null {
    const requestOriginUrl = request.getHeader('origin') as string || request.getHeader('referer') as string
    const requestHostUrl = request.getHeader('host')

    if (this.pluginOptions.hostUrl && requestHostUrl !== this.pluginOptions.hostUrl) {
      this.terminateResponse(response, HTTPStatus.FORBIDDEN, 'Forbidden Host.')
      return null
    }

    if (this.pluginOptions.origins!.indexOf(requestOriginUrl) === -1) {
      if (!requestOriginUrl) {
        this.terminateResponse(
          response,
          HTTPStatus.FORBIDDEN,
          'CORS is configured for this. All requests must set a valid "Origin" header.',
          // No additional headers known at this point for the error response itself
        )
      } else {
        this.terminateResponse(
          response,
          HTTPStatus.FORBIDDEN,
          `Origin "${requestOriginUrl}" is forbidden.`,
          // No additional headers known at this point for the error response itself
        )
      }
      return null
    }

    // If verification is successful, return the headers to be set by the caller.
    return {
      'Access-Control-Allow-Origin': requestOriginUrl,
      'Access-Control-Allow-Credentials': 'true', // Typically needed with specific origins
      'Vary': 'Origin' // Good practice when Access-Control-Allow-Origin is dynamic
    }
  }

  private handleOptions (response: uws.HttpResponse, request: uws.HttpRequest, baseCorsHeaders: Dictionary<string>): void {
    const allHeadersForResponse = { ...baseCorsHeaders }

    const requestMethod = request.getHeader('access-control-request-method') as string | undefined
    if (!requestMethod) {
      this.terminateResponse(
        response,
        HTTPStatus.BAD_REQUEST,
        'Missing header "Access-Control-Request-Method".',
        allHeadersForResponse // Pass along already determined CORS headers
      )
      return
    }
    if (this.methods.indexOf(requestMethod) === -1) {
      this.terminateResponse(
        response,
        HTTPStatus.FORBIDDEN,
        `Method ${requestMethod} is forbidden. Supported methods: ${this.methodsStr}`,
        allHeadersForResponse
      )
      return
    }

    const requestHeadersRaw = request.getHeader('access-control-request-headers') as string | undefined
    if (!requestHeadersRaw) {
      // Some browsers might not send this for simple requests, but for preflight it's expected.
      // Depending on strictness, this could be an error or allowed.
      // For now, let's assume it's required for a preflight OPTIONS.
      this.terminateResponse(
        response,
        HTTPStatus.BAD_REQUEST,
        'Missing header "Access-Control-Request-Headers".'
      )
      return
    }
    const requestHeaders = requestHeadersRaw.split(',')
    for (let i = 0; i < requestHeaders.length; i++) {
      if (this.headersLower.indexOf(requestHeaders[i].trim().toLowerCase()) === -1) {
        this.terminateResponse(
          response,
          HTTPStatus.FORBIDDEN,
          `Header ${requestHeaders[i]} is forbidden. Supported headers: ${this.headersStr}`,
          allHeadersForResponse
        )
        return
      }
    }

    allHeadersForResponse['Access-Control-Allow-Methods'] = this.methodsStr
    allHeadersForResponse['Access-Control-Allow-Headers'] = this.headersStr
    this.terminateResponse(response, HTTPStatus.NO_CONTENT, undefined, allHeadersForResponse)
  }
}

/* Helper function for reading a posted JSON body */
function readJson (res: uws.HttpResponse, cb: Function, err: (code: number) => void, limit: number) {
  let buffer: Buffer
  let received: number = 0

  res.onData((ab, isLast) => {
    const chunk = Buffer.from(ab)
    received += chunk.length
    // check max length
    if (received > limit) {
      err(HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
      return
    }

    if (isLast) {
      let json
      if (buffer) {
        try {
          json = JSON.parse(Buffer.concat([buffer, chunk]).toString())
        } catch (e) {
          err(HTTPStatus.BAD_REQUEST)
          return
        }
        cb(json)
      } else {
        try {
          json = JSON.parse(chunk.toString())
        } catch (e) {
          err(HTTPStatus.BAD_REQUEST)
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
