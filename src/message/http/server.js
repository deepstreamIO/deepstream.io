'use strict'

const fileUtils = require('../../config/file-utils')
const url = require('url')
const EventEmitter = require('events')
const HTTPStatus = require('http-status')
const contentType = require('content-type')
const UWSConnectionEndpoint = require('../uws/connection-endpoint')


function readJson (metadata, res, cb) {
  let buffer
  res.onData((ab, isLast) => {
    const chunk = Buffer.from(ab)
    if (isLast) {
      let json
      if (buffer) {
        try {
          json = JSON.parse(Buffer.concat([buffer, chunk]))
        } catch (e) {
          cb('error parsing', null, null, res)
          return
        }
        cb(null, json, metadata, res)
      } else {
        try {
          json = JSON.parse(chunk)
        } catch (e) {
          cb('error parsing', null, null, res)
          return
        }
        cb(null, json, metadata, res)
      }
    } else if (buffer) {
      buffer = Buffer.concat([buffer, chunk])
    } else {
      buffer = Buffer.concat([chunk])
    }
  })
}

function checkConfigOption (config, option, expectedType) {
  if ((expectedType && typeof config[option] !== expectedType) || config[option] === undefined) {
    throw new Error(`The HTTP plugin requires that the "${option}" config option is set`)
  }
}

module.exports = class Server extends EventEmitter {
  constructor (config, constants, logger) {
    super()

    this._config = config
    this._constants = constants
    this._logger = logger

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

    this._methods = ['GET', 'POST', 'OPTIONS']
    this._methodsStr = this._methods.join(', ')
    this._headers = ['X-Requested-With', 'X-HTTP-Method-Override', 'Content-Type', 'Accept']
    this._headersLower = this._headers.map(header => header.toLowerCase())
    this._headersStr = this._headers.join(', ')

    // alias require to trick nexe from bundling it
    const req = require
    try {
      this.uWS = req('uWebSockets.js')
    } catch (e) {
      this.uWS = req(fileUtils.lookupLibRequirePath('uWebSockets.js'))
    }

    this._listenSocket = null
  }

  start () {
    this._httpServer = UWSConnectionEndpoint.getServer(this.uWS, {}, {})
    this._httpServer.any('*', this._onRequest.bind(this))
    this._httpServer.listen(this._config.host, this._config.port, this._onReady.bind(this))
  }

  stop (callback) {
    this.uWS.us_listen_socket_close(this._listenSocket)
    setTimeout(callback, 2000)
  }

  /**
   * Called when the server starts listening for requests.
   *
   * @private
   * @returns {void}
   */
  _onReady (token) {
    if (token) {
      this._listenSocket = token
      const C = this._constants
      const wsMsg = `Listening for http connections on ${this._config.host}:${this._config.port}`
      this._logger.info(C.EVENT.INFO, wsMsg)
      const hcMsg = `Listening for health checks on path ${this._config.healthCheckPath} `
      this._logger.info(C.EVENT.INFO, hcMsg)
      this.emit('ready')
      this.isReady = true
    } else {
      const C = this._constants
      this._logger.error(C.EVENT.CONNECTION_ERROR, 'HTTP server was not able to start listening')
    }

  }

  static _terminateResponse (response, code, message) {
    response.writeStatus(`${code}`)
    response.writeHeader('Content-Type', 'text/plain; charset=utf-8')
    response.end(`${message}\r\n\r\n`)
  }

  _onRequest (response, request) {
    response.onAborted(() => {
      response.aborted = true
    })

    if (!this._config.allowAllOrigins) {
      if (!this._verifyOrigin(request, response)) {
        return
      }
    }

    switch (request.getMethod()) {
      case 'post':
        this._handlePost(request, response)
        break
      case 'get':
        this._handleGet(request, response)
        break
      case 'options':
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

  _verifyOrigin (request, response) {
    const requestOriginUrl = request.getHeader('origin') || request.getHeader('referer')
    const requestHostUrl = request.getHeader('host')
    if (this._config.hostUrl && requestHostUrl !== this._config.hostUrl) {
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
    response.writeHeader('Access-Control-Allow-Origin', requestOriginUrl)
    response.writeHeader('Access-Control-Allow-Credentials', true)
    response.writeHeader('Vary', 'Origin')

    return true
  }

  _handlePost (request, response) {
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

    const metadata = {
      headers: UWSConnectionEndpoint.getHeaders(this._config.headers, request),
      url: request.getUrl()
    }

    // eslint-disable-next-line
    readJson(metadata, response, (err, json, metadata, response) => {
      if (err) {
        Server._terminateResponse(
          response,
          HTTPStatus.BAD_REQUEST,
          `Failed to parse body of request: ${err.message}`
        )
        return
      }
      const onResponse = Server._onHandlerResponse.bind(
          null, response, this._config.allowAllOrigins
      )

      if (this._config.enableAuthEndpoint && this.authPathRegExp.test(metadata.url)) {
        this.emit('auth-message', json, metadata, onResponse)

      } else if (this.postPathRegExp.test(metadata.url)) {
        this.emit('post-message', json, metadata, onResponse)

      } else {
        Server._terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.')
      }
    })
  }

  _handleGet (request, response) {
    const parsedUrl = url.parse(request.getUrl(), true)
    const onResponse = Server._onHandlerResponse.bind(null, response, this._config.allowAllOrigins)

    if (parsedUrl.pathname === this._config.healthCheckPath) {
      response.writeStatus(`${HTTPStatus.OK}`)
      response.writeHeader('Content-Type', 'text/plain; charset=utf-8')
      response.end('OK\r\n\r\n')

    } else if (this.getPathRegExp.test(parsedUrl.pathname)) {
      this.emit('get-message', parsedUrl.query, UWSConnectionEndpoint.getHeaders(this._config.headers, request), onResponse)

    } else {
      Server._terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.')
    }
  }

  _handleOptions (request, response) {
    const requestMethod = request.getHeader('access-control-request-method')
    if (this._methods.indexOf(requestMethod) === -1) {
      Server._terminateResponse(
        response,
        HTTPStatus.FORBIDDEN,
        `Method ${requestMethod} is forbidden. Supported methods: ${this._methodsStr}`
      )
      return
    }

    const requestHeaders = request.getHeader('access-control-request-headers').split(',')
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
    if (this._config.allowAllOrigins) {
      response.writeHeader('Access-Control-Allow-Origin', '*')
    }
    response.writeHeader('Access-Control-Allow-Methods', this._methodsStr)
    response.writeHeader('Access-Control-Allow-Headers', this._headersStr)
    Server._terminateResponse(response, HTTPStatus.OK, 'OK')
  }

  static _onHandlerResponse (response, allowAllOrigins, err, data) {
    if (err) {
      const statusCode = err.statusCode || HTTPStatus.BAD_REQUEST
      Server._terminateResponse(response, statusCode, err.message)
      return
    }
    response.writeStatus(`${HTTPStatus.OK}`)
    response.writeHeader('Content-Type', 'application/json; charset=utf-8')
    if (allowAllOrigins) {
      response.writeHeader('Access-Control-Allow-Origin', '*')
    }
    response.end(`${JSON.stringify(data)}\r\n\r\n`)
  }
}
