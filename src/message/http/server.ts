'use strict'

import * as http from 'http'
import * as https from 'https'
import * as url from 'url'
import { EventEmitter } from 'events'
import * as HTTPStatus from 'http-status'
import * as contentType from 'content-type'
import * as bodyParser from 'body-parser'
import * as httpShutdown from 'http-shutdown'
import { EVENT } from '../../constants'

function checkConfigOption (config: any, option, expectedType?): void {
  if ((expectedType && typeof config[option] !== expectedType) || config[option] === undefined) {
    throw new Error(`The HTTP plugin requires that the "${option}" config option is set`)
  }
}

export default class Server extends EventEmitter {

  public isReady: boolean = false

  private _origins: string
  private authPathRegExp: RegExp
  private postPathRegExp: RegExp
  private getPathRegExp: RegExp
  private _methods: Array<string> = ['GET', 'POST', 'OPTIONS']
  private _methodsStr: string = this._methods.join(', ')
  private _headers: Array<string> = ['X-Requested-With', 'X-HTTP-Method-Override', 'Content-Type', 'Accept']
  private _headersLower: Array<string> = this._headers.map(header => header.toLowerCase())
  private _headersStr: string = this._headers.join(', ')
  private _jsonBodyParser = bodyParser.json({
    inflate: true,
    limit: '1mb' // TODO: make this configurable
  })
  private _httpServer: any
  private _sslKey: string
  private _sslCert: string
  private _sslCa: string

  constructor (private config: any, private logger: Logger) {
    super()

    checkConfigOption(config, 'port', 'number')
    checkConfigOption(config, 'host')
    checkConfigOption(config, 'enableAuthEndpoint', 'boolean')
    checkConfigOption(config, 'authPath', 'string')
    checkConfigOption(config, 'postPath', 'string')
    checkConfigOption(config, 'getPath', 'string')
    checkConfigOption(config, 'healthCheckPath', 'string')
    checkConfigOption(config, 'allowAllOrigins', 'boolean')
    // checkConfigOption(config, 'maxRequestPayload', 'number')

    if (config.allowAllOrigins === false) {
      checkConfigOption(config, 'origins', 'string')
      this._origins = config.origins
    }

    this.authPathRegExp = new RegExp(`^${config.authPath}/?(.*)$`, 'i')
    this.postPathRegExp = new RegExp(`^${config.postPath}/?(.*)$`, 'i')
    this.getPathRegExp = new RegExp(`^${config.getPath}/?(.*)$`, 'i')
  }

  public start (): void {
    this._httpServer = httpShutdown(this._createHttpServer())
    this._httpServer.on('request', this._onRequest.bind(this))

    this._httpServer.once('listening', this._onReady.bind(this))
    this._httpServer.on('error', this._onError.bind(this))

    this._httpServer.listen(this.config.port, this.config.host)
  }

  public stop (callback): void {
    this._httpServer.shutdown(callback)
  }

  /**
   * Called when the server starts listening for requests.
   *
   * @private
   * @returns {void}
   */
  private _onReady (): void {
    const serverAddress = this._httpServer.address()
    const address = serverAddress.address
    const port = serverAddress.port
    const wsMsg = `Listening for http connections on ${address}:${port}`
    this.logger.info(EVENT.INFO, wsMsg)
    const hcMsg = `Listening for health checks on path ${this.config.healthCheckPath} `
    this.logger.info(EVENT.INFO, hcMsg)
    this.emit('ready')
    this.isReady = true
  }

  static _terminateResponse (response, code: HTTPStatus, message: string) {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.writeHead(code)
    response.end(`${message}\r\n\r\n`)
  }

  /**
   * Creates an HTTP or HTTPS server for ws to attach itself to,
   * depending on the options the client configured
   *
   * @private
   * @returns {http.HttpServer | http.HttpsServer}
   */
  private _createHttpServer (): http.Server | https.Server {
    const httpsParams = this._getHttpsParams()
    if (httpsParams) {
      return https.createServer(httpsParams)
    }
    return http.createServer()
  }

  /**
  * Returns sslKey, sslCert and sslCa options from the config.
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
  private _getHttpsParams (): object {
    const key = this._sslKey
    const cert = this._sslCert
    const ca = this._sslCa
    if (key || cert) {
      if (!key) {
        throw new Error('Must also include sslKey in order to use HTTPS')
      }
      if (!cert) {
        throw new Error('Must also include sslCert in order to use HTTPS')
      }

      return { key, cert, ca }
    }
    return {}
  }

  private _onRequest (
    request: http.IncomingMessage | https.IncomingMessage,
    response: http.ServerResponse | https.ServerResponse
   ): void {
    if (!this.config.allowAllOrigins) {
      if (!this._verifyOrigin(request, response)) {
        return
      }

    } else {
      response.setHeader('Access-Control-Allow-Origin', '*')
    }

    switch (request.method) {
      case 'POST':
        this._handlePost(request, response)
        break
      case 'GET':
        this._handleGet(request, response)
        break
      case 'OPTIONS':
        this._handleOptions(request, response)
        break
      default:
        Server._terminateResponse(
          response,
          HTTPStatus.METHOD_NOT_ALLOWED,
          `Unsupported method. Supported methods: ${this._methodsStr}`
        )
    }
  }

  _verifyOrigin (
    request: http.IncomingMessage | https.IncomingMessage,
    response: http.ServerResponse | https.ServerResponse
  ): boolean {
    const requestOriginUrl = request.headers.origin as string || request.headers.referer as string
    const requestHostUrl = request.headers.host
    if (this.config.hostUrl && requestHostUrl !== this.config.hostUrl) {
      Server._terminateResponse(response, HTTPStatus.FORBIDDEN, 'Forbidden Host.')
      return false
    }
    if (this._origins.indexOf(requestOriginUrl) === -1) {
      if (!requestOriginUrl) {
        Server._terminateResponse(
          response,
          HTTPStatus.FORBIDDEN,
          'CORS is configured for this server. All requests must set a valid "Origin" header.'
        )
      } else {
        Server._terminateResponse(
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

  _handlePost (
    request,
    response
  ): void {
    let parsedContentType
    try {
      parsedContentType = contentType.parse(request)
    } catch (typeError) {
      parsedContentType = { type: null }
    }
    if (parsedContentType.type !== 'application/json') {
      Server._terminateResponse(
        response,
        HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
        'Invalid "Content-Type" header. Supported media types: "application/json"'
      )
      return
    }

    this._jsonBodyParser(request, response, (err) => {
      if (err) {
        Server._terminateResponse(
          response,
          HTTPStatus.BAD_REQUEST,
          `Failed to parse body of request: ${err.message}`
        )
        return
      }
      const onResponse = Server._onHandlerResponse.bind(null, response)
      const metadata = { headers: request.headers, url: request.url }

      if (this.config.enableAuthEndpoint && this.authPathRegExp.test(request.url)) {
        this.emit('auth-message', request.body, metadata, onResponse)

      } else if (this.postPathRegExp.test(request.url)) {
        this.emit('post-message', request.body, metadata, onResponse)

      } else {
        Server._terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.')
      }
    })
  }

  _handleGet (
    request: http.IncomingMessage | https.IncomingMessage,
    response: http.ServerResponse | https.ServerResponse
   ): void {
    const parsedUrl = url.parse(request.url as string, true)
    const onResponse = Server._onHandlerResponse.bind(null, response)

    if (parsedUrl.pathname === this.config.healthCheckPath) {
      response.setHeader('Content-Type', 'text/plain; charset=utf-8')
      response.writeHead(HTTPStatus.OK)
      response.end('OK\r\n\r\n')

    } else if (this.getPathRegExp.test(parsedUrl.pathname as string)) {
      this.emit('get-message', parsedUrl.query, request.headers, onResponse)

    } else {
      Server._terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.')
    }
  }

  _handleOptions (
    request: http.IncomingMessage | https.IncomingMessage,
    response: http.ServerResponse | https.ServerResponse
  ): void {
    const requestMethod = request.headers['access-control-request-method'] as string
    if (this._methods.indexOf(requestMethod) === -1) {
      Server._terminateResponse(
        response,
        HTTPStatus.FORBIDDEN,
        `Method ${requestMethod} is forbidden. Supported methods: ${this._methodsStr}`
      )
      return
    }

    const requestHeaders = typeof request.headers['access-control-request-headers'] === 'string'
      ? (request.headers['access-control-request-headers'] as string).split(',')
      : request.headers['access-control-request-headers']
    for (let i = 0; i < requestHeaders.length; i++) {
      if (this._headersLower.indexOf(requestHeaders[i].trim().toLowerCase()) === -1) {
        Server._terminateResponse(
          response,
          HTTPStatus.FORBIDDEN,
          `Header ${requestHeaders[i]} is forbidden. Supported headers: ${this._headersStr}`
        )
        return
      }
    }

    response.setHeader('Access-Control-Allow-Methods', this._methodsStr)
    response.setHeader('Access-Control-Allow-Headers', this._headersStr)
    Server._terminateResponse(response, HTTPStatus.OK, 'OK')
  }

  static _onHandlerResponse (
    response: http.ServerResponse | https.ServerResponse,
    err: { statusCode: HTTPStatus, message: string },
    data: { result: string, body: object }
  ): void {
    if (err) {
      const statusCode = err.statusCode || HTTPStatus.BAD_REQUEST
      Server._terminateResponse(response, statusCode, err.message)
      return
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.writeHead(HTTPStatus.OK)
    response.end(`${JSON.stringify(data)}\r\n\r\n`)
  }

  /**
   * Generic callback for connection errors. This will most often be called
   * if the configured port number isn't available
   *
   * @param   {String} error
   *
   * @private
   * @returns {void}
   */
  _onError (error: string): void {
    this.logger.error(EVENT.CONNECTION_ERROR, error.toString())
  }
}
