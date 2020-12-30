import { DeepstreamPlugin, DeepstreamHTTPService, EVENT, PostRequestHandler, GetRequestHandler, DeepstreamHTTPMeta, DeepstreamHTTPResponse, SocketHandshakeData, DeepstreamServices, DeepstreamConfig, SocketWrapper, WebSocketConnectionEndpoint, SocketWrapperFactory } from '@deepstream/types'
// @ts-ignore
import * as httpShutdown from 'http-shutdown'
import * as http from 'http'
import * as https from 'https'
import * as HTTPStatus from 'http-status'
import * as contentType from 'content-type'
import * as bodyParser from 'body-parser'
import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { Socket } from 'net'
import { Dictionary } from 'ts-essentials'
interface NodeHTTPInterface {
    healthCheckPath: string,
    host: string,
    port: number,
    allowAllOrigins: boolean,
    origins?: string[],
    maxMessageSize: number,
    hostUrl: string,
    headers: string[],
    ssl?: {
      key: string,
      cert: string,
      ca?: string
    }
}

export class NodeHTTP extends DeepstreamPlugin implements DeepstreamHTTPService {
  public description: string = 'NodeJS HTTP Service'
  private server!: http.Server | https.Server
  private isReady: boolean = false
  private origins?: string[]

  private methods: string[] = ['GET', 'POST', 'OPTIONS']
  private methodsStr: string = this.methods.join(', ')
  private headers: string[] = ['X-Requested-With', 'X-HTTP-Method-Override', 'Content-Type', 'Accept']
  private headersLower: string[] = this.headers.map((header) => header.toLowerCase())
  private headersStr: string = this.headers.join(', ')
  private jsonBodyParser: any

  private postPaths = new Map<string, PostRequestHandler<any>>()
  private getPaths = new Map<string, GetRequestHandler>()
  private upgradePaths = new Map<string, WebSocket.Server>()

  private sortedPostPaths: string[] = []
  private sortedGetPaths: string[] = []
  private sortedUpgradePaths: string[] = []

  private connections = new Map<WebSocket, SocketWrapper>()
  private emitter = new EventEmitter()

  constructor (private pluginOptions: NodeHTTPInterface, private services: DeepstreamServices, config: DeepstreamConfig) {
    super()

    if (this.pluginOptions.allowAllOrigins === false) {
        if (!this.pluginOptions.origins) {
          this.services.logger.fatal(EVENT.INVALID_CONFIG_DATA, 'HTTP allowAllOrigins set to false but no origins provided')
        }
    }

    this.jsonBodyParser = bodyParser.json({
        inflate: true,
        limit: `${pluginOptions.maxMessageSize / 1024}mb`
    })
  }

  public async whenReady (): Promise<void> {
    if (this.isReady) {
        return
    }
    if (!this.server) {
      const server: http.Server = this.createHttpServer()
      this.server = httpShutdown(server)
      this.server.on('request', this.onRequest.bind(this))
      this.server.on('upgrade', this.onUpgrade.bind(this))
      this.server.listen(this.pluginOptions.port, this.pluginOptions.host, () => {
          const serverAddress = this.server.address() as WebSocket.AddressInfo
          const address = serverAddress.address
          const port = serverAddress.port
          this.services.logger.info(EVENT.INFO, `Listening for http connections on ${address}:${port}`)
          this.services.logger.info(EVENT.INFO, `Listening for health checks on path ${this.pluginOptions.healthCheckPath}`)
          this.registerGetPathPrefix(this.pluginOptions.healthCheckPath, (meta: DeepstreamHTTPMeta, response: DeepstreamHTTPResponse) => {
            response(null)
          })
          this.isReady = true
          this.emitter.emit('ready')
      })
    }
    return new Promise((resolve) => this.emitter.once('ready', resolve))
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

    // @ts-ignore
    return new Promise((resolve) => this.server.shutdown(resolve))
  }

  public sendWebsocketMessage (socket: WebSocket, message: any, isBinary: boolean) {
    socket.send(message)
  }

  public getSocketWrappersForUserId (userId: string) {
    return [...this.connections.values()].filter((socketWrapper) => socketWrapper.userId === userId)
  }

  public registerPostPathPrefix<DataInterface> (prefix: string, handler: PostRequestHandler<DataInterface>) {
    this.postPaths.set(prefix, handler)
    this.sortedPostPaths = [...this.postPaths.keys()].sort().reverse()
  }

  public registerGetPathPrefix (prefix: string, handler: GetRequestHandler) {
    this.getPaths.set(prefix, handler)
    this.sortedGetPaths = [...this.getPaths.keys()].sort().reverse()
  }

  public registerWebsocketEndpoint (path: string, createSocketWrapper: SocketWrapperFactory, webSocketConnectionEndpoint: WebSocketConnectionEndpoint) {
    const server = new WebSocket.Server({ noServer: true, maxPayload:  webSocketConnectionEndpoint.wsOptions.maxMessageSize})
    server.on('connection', (websocket: WebSocket, handshakeData: SocketHandshakeData) => {
      websocket.on('error', (error) => {
        this.services.logger.error(EVENT.ERROR, `Error on websocket: ${error.message}`)
      })

      const socketWrapper = createSocketWrapper(websocket, handshakeData, this.services, webSocketConnectionEndpoint.wsOptions, webSocketConnectionEndpoint)
      socketWrapper.lastMessageRecievedAt = Date.now()
      this.connections.set(websocket, socketWrapper)

      const interval = setInterval(() => {
        if ((Date.now() - socketWrapper.lastMessageRecievedAt) > webSocketConnectionEndpoint.wsOptions.heartbeatInterval * 2) {
          this.services.logger.error(EVENT.INFO, 'Heartbeat missing on websocket, terminating connection')
          socketWrapper.destroy()
        }
      }, webSocketConnectionEndpoint.wsOptions.heartbeatInterval)

      websocket.on('close', () => {
        clearInterval(interval)
        webSocketConnectionEndpoint.onSocketClose.call(webSocketConnectionEndpoint, socketWrapper)
        this.connections.delete(websocket)
      })

      websocket.on('message', (msg: string) => {
        socketWrapper.lastMessageRecievedAt = Date.now()
        const messages = socketWrapper.parseMessage(msg)
        if (messages.length > 0) {
          socketWrapper.onMessage(messages)
        }
      })

      webSocketConnectionEndpoint.onConnection.call(webSocketConnectionEndpoint, socketWrapper)
    })
    this.upgradePaths.set(path, server)
    this.sortedUpgradePaths = [...this.upgradePaths.keys()].sort().reverse()
  }

  private createHttpServer () {
    if (this.pluginOptions.ssl) {
      const { key, cert, ca } = this.pluginOptions.ssl
      if (!key || !cert) {
        this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'To enable HTTP please provide a key and cert')
      }
      return new https.Server({ key, cert, ca })
    }
    return new http.Server()
  }

  private onUpgrade (
    request: http.IncomingMessage,
    socket: Socket,
    head: Buffer
   ): void {
    for (const path of this.sortedUpgradePaths) {
      if (request.url === path) {
        const wss = this.upgradePaths.get(path)!
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, {
            remoteAddress: request.headers['x-forwarded-for'] || request.connection.remoteAddress,
            headers: request.headers,
            referer: request.headers.referer
          })
        })
        return
      }
    }
    socket.destroy()
   }

  private onRequest (
    request: http.IncomingMessage,
    response: http.ServerResponse
   ): void {
     if (!this.pluginOptions.allowAllOrigins) {
       if (!this.verifyOrigin(request, response)) {
         return
       }
     } else {
       response.setHeader('Access-Control-Allow-Origin', '*')
     }

     switch (request.method) {
       case 'POST':
         this.handlePost(request, response)
         break
       case 'GET':
         this.handleGet(request, response)
         break
       case 'OPTIONS':
         this.handleOptions(request, response)
         break
       default:
         this.terminateResponse(
           response,
           HTTPStatus.METHOD_NOT_ALLOWED,
           `Unsupported method. Supported methods: ${this.methodsStr}`
         )
     }
   }

   private handlePost (request: http.IncomingMessage, response: http.ServerResponse): void {
    let parsedContentType
    try {
      parsedContentType = contentType.parse(request)
    } catch (typeError) {
      parsedContentType = { type: null }
    }
    if (parsedContentType.type !== 'application/json') {
      this.terminateResponse(
        response,
        HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
        'Invalid "Content-Type" header. Supported media types: "application/json"'
      )
      return
    }

    this.jsonBodyParser(request, response, (err: Error | null) => {
      if (err) {
        this.terminateResponse(
          response,
          HTTPStatus.BAD_REQUEST,
          `Failed to parse body of request: ${err.message}`
        )
        return
      }

      for (const path of this.sortedPostPaths) {
        if (request.url!.startsWith(path)) {
          this.postPaths.get(path)!(
            (request as any).body,
            { headers: request.headers as Dictionary<string>, url: request.url! },
            this.sendResponse.bind(this, response)
          )
          return
        }
      }
      this.terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.')
    })
  }

  private handleGet (request: http.IncomingMessage, response: http.ServerResponse) {
    for (const path of this.sortedGetPaths) {
      if (request.url!.startsWith(path)) {
        this.getPaths.get(path)!(
          { headers: request.headers as Dictionary<string>, url: request.url! },
          this.sendResponse.bind(this, response)
        )
        return
      }
    }
    this.terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.')
  }

   private handleOptions (
    request: http.IncomingMessage,
    response: http.ServerResponse
  ): void {
    const requestMethod = request.headers['access-control-request-method'] as string | undefined
    if (!requestMethod) {
      this.terminateResponse(
        response,
        HTTPStatus.BAD_REQUEST,
        'Missing header "Access-Control-Request-Method".'
      )
      return
    }
    if (this.methods.indexOf(requestMethod) === -1) {
      this.terminateResponse(
        response,
        HTTPStatus.FORBIDDEN,
        `Method ${requestMethod} is forbidden. Supported methods: ${this.methodsStr}`
      )
      return
    }

    const requestHeadersRaw = request.headers['access-control-request-headers'] as string | undefined
    if (!requestHeadersRaw) {
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
          `Header ${requestHeaders[i]} is forbidden. Supported headers: ${this.headersStr}`
        )
        return
      }
    }

    response.setHeader('Access-Control-Allow-Methods', this.methodsStr)
    response.setHeader('Access-Control-Allow-Headers', this.headersStr)
    this.terminateResponse(response, HTTPStatus.NO_CONTENT)
  }

  private verifyOrigin (
    request: http.IncomingMessage,
    response: http.ServerResponse
  ): boolean {
    const requestOriginUrl = request.headers.origin as string || request.headers.referer as string
    const requestHostUrl = request.headers.host
    if (this.pluginOptions.hostUrl && requestHostUrl !== this.pluginOptions.hostUrl) {
      this.terminateResponse(response, HTTPStatus.FORBIDDEN, 'Forbidden Host.')
      return false
    }
    if (this.origins!.indexOf(requestOriginUrl) === -1) {
      if (!requestOriginUrl) {
        this.terminateResponse(
          response,
          HTTPStatus.FORBIDDEN,
          'CORS is configured for this. All requests must set a valid "Origin" header.'
        )
      } else {
        this.terminateResponse(
          response,
          HTTPStatus.FORBIDDEN,
          `Origin "${requestOriginUrl}" is forbidden.`
        )
      }
      return false
    }

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
    response.setHeader('Access-Control-Allow-Origin', requestOriginUrl)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    response.setHeader('Vary', 'Origin')

    return true
  }

  private terminateResponse (response: http.ServerResponse, code: number, message?: string) {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.writeHead(code)
    if (message) {
      response.end(`${message}\r\n\r\n`)
    } else {
      response.end()
    }
  }

  private sendResponse (
    response: http.ServerResponse,
    err: { statusCode: number, message: string } | null,
    data: { result: string, body: object }
  ): void {
    if (err) {
      const statusCode = err.statusCode || HTTPStatus.BAD_REQUEST
      this.terminateResponse(response, statusCode, err.message)
      return
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.writeHead(HTTPStatus.OK)
    if (data) {
      response.end(`${JSON.stringify(data)}\r\n\r\n`)
    } else {
      response.end()
    }
  }
}
