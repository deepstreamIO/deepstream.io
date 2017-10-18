import { TOPIC, CONNECTION_ACTIONS, AUTH_ACTIONS, EVENT, PARSER_ACTIONS } from '../../constants'
import * as messageBuilder from '../../../protocol/text/src/message-builder'
import { createSocketWrapper } from './socket-wrapper-factory'
import { EventEmitter } from 'events'
import * as https from 'https'
import * as http from 'http'
import * as uws from 'uws'

const OPEN = 'OPEN'

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 *
 * @constructor
 *
 * @extends events.EventEmitter
 *
 * @param {Object} options the extended default options
 * @param {Function} readyCallback will be invoked once both the ws is ready
 */
export default class UWSConnectionEndpoint extends EventEmitter implements ConnectionEndpoint {

  public isReady: boolean = false
  public description: string = 'µWebSocket Connection Endpoint'

  private _dsOptions: any
  private initialised: boolean = false
  private _flushTimeout: number | null
  private _authenticatedSockets: Set<SocketWrapper> = new Set()
  private _logger: Logger
  private _authenticationHandler: AuthenticationHandler
  private _server: https.Server | http.Server
  private _logInvalidAuthData: boolean
  private _healthCheckPath: string
  private _maxAuthAttempts: number
  private _urlPath: string
  private _noDelay: boolean
  private _unauthenticatedClientTimeout: number
  private _serverGroup: any
  private _scheduledSocketWrapperWrites: Set<SocketWrapper>
  private _upgradeRequest: any

  constructor (private options: any, private services: DeepstreamServices) {
    super()
    this._flushSockets = this._flushSockets.bind(this)
  }

  /**
   * Called on initialization with a reference to the instantiating deepstream server.
   */
  public setDeepstream (deepstream): void {
    this._dsOptions = deepstream.config
    this._logger = deepstream.services.logger
    this._authenticationHandler = deepstream.services.authenticationHandler
  }

  /**
   * Initialise and setup the http and WebSocket servers.
   *
   * @throws Will throw if called before `setDeepstream()`.
   */
  public init (): void {
    if (!this._dsOptions) {
      throw new Error('setDeepstream must be called before init()')
    }
    if (this.initialised) {
      throw new Error('init() must only be called once')
    }
    this.initialised = true

    this._healthCheckPath = this._getOption('healthCheckPath')

    this._maxAuthAttempts = this._getOption('maxAuthAttempts')
    this._logInvalidAuthData = this._getOption('logInvalidAuthData')
    this._urlPath = this._getOption('urlPath')
    this._unauthenticatedClientTimeout = this._getOption('unauthenticatedClientTimeout')

    this._uwsInit()

    this._server = this._createHttpServer()
    this._server.on('request', this._handleHealthCheck.bind(this))

    this._server.once('listening', this._onReady.bind(this))
    this._server.on('error', this._onError.bind(this))
    this._server.on('upgrade', this._onUpgradeRequest.bind(this))

    const port = this._getOption('port')
    const host = this._getOption('host')
    this._server.listen(port, host)
  }

  /**
   * Called from a socketWrapper. This method tells the connection endpoint
   * to flush the socket after a certain amount of time, used to low priority
   * messages
   * @param  {UwsSocketWrapper} socketWrapper SocketWrapper with a flush
   */
  public scheduleFlush (socketWrapper) {
    this._scheduledSocketWrapperWrites.add(socketWrapper)
    if (!this._flushTimeout) {
      this._flushTimeout = setTimeout(this._flushSockets, this.options.outgoingBufferTimeout)
    }
  }

  /**
   * Called when the flushTimeout occurs in order to send  all pending socket acks
   */
  private _flushSockets () {
    for (const socketWrapper of this._scheduledSocketWrapperWrites) {
      socketWrapper.flush()
    }
    this._scheduledSocketWrapperWrites.clear()
    this._flushTimeout = null
  }

  /**
   * Get a parameter from the root of the deepstream options if present, otherwise get it from the
   * plugin config. If neither is present, default to the optionally provided default.
   *
   * @param {String} option  The name of the option to be fetched
   */
  private _getOption (option) {
    const value = this._dsOptions[option]
    if ((value === null || value === undefined) && (this.options[option] !== undefined)) {
      return this.options[option]
    }
    return value
  }

  /**
   * Initialize the uws endpoint, setup callbacks etc.
   */
  private _uwsInit () {
    const maxMessageSize = this._getOption('maxMessageSize')
    const perMessageDeflate = this._getOption('perMessageDeflate')
    this._serverGroup = uws.native.server.group.create(perMessageDeflate, maxMessageSize)
    this._noDelay = this._getOption('noDelay')

    uws.native.server.group.onDisconnection(
      this._serverGroup,
      (external, code, message, socketWrapper) => {
        if (socketWrapper) {
          socketWrapper.close()
        }
      }
    )

    uws.native.server.group.onMessage(this._serverGroup, (message, socketWrapper) => {
      const parsedMessages = socketWrapper.parseMessage(message)
      socketWrapper.onMessage(parsedMessages)
    })

    uws.native.server.group.onPing(this._serverGroup, () => {})
    uws.native.server.group.onPong(this._serverGroup, () => {})
    uws.native.server.group.onConnection(this._serverGroup, this._onConnection.bind(this))

    // TODO: This will become an issue when distinguishing
    // between different protocols
    uws.native.server.group.startAutoPing(
      this._serverGroup,
      this._getOption('heartbeatInterval'),
      messageBuilder.getMessage({
        topic: TOPIC.CONNECTION,
        action: CONNECTION_ACTIONS.PING
      }, false)
    )
  }

  /**
   * Called for the ready event of the ws server.
   */
  private _onReady (): void {
    const serverAddress = this._server.address()
    const address = serverAddress.address
    const port = serverAddress.port
    const wsMsg = `Listening for websocket connections on ${address}:${port}${this._urlPath}`
    this._logger.info(EVENT.INFO, wsMsg)
    const hcMsg = `Listening for health checks on path ${this._healthCheckPath} `
    this._logger.info(EVENT.INFO, hcMsg)
    this.emit('ready')
    this.isReady = true
  }

  /**
   * Called for every message that's received
   * from an authenticated socket
   *
   * This method will be overridden by an external class and is used instead
   * of an event emitter to improve the performance of the messaging pipeline
   */
  public onMessages (socketWrapper: SocketWrapper, messages: Array<Message>) { // eslint-disable-line
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
  private _getHttpsParams (): { key: string, cert: string, ca: string | undefined } | null {
    const key = this._getOption('sslKey')
    const cert = this._getOption('sslCert')
    const ca = this._getOption('sslCa')
    if (key || cert) {
      if (!key) {
        throw new Error('Must also include sslKey in order to use HTTPS')
      }
      if (!cert) {
        throw new Error('Must also include sslCert in order to use HTTPS')
      }
      return { key, cert, ca }
    }
    return null
  }

  /**
   * Responds to http health checks.
   * Responds with 200(OK) if deepstream is alive.
   *
   * @private
   * @returns {void}
   */
  private _handleHealthCheck (
    req: http.IncomingMessage | https.IncomingMessage,
    res: http.ServerResponse | https.ServerResponse
  ) {
    if (req.method === 'GET' && req.url === this._healthCheckPath) {
      res.writeHead(200)
      res.end()
    }
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
  private _onConnection (external) {
    const address = uws.native.getAddress(external)
    const handshakeData = {
      remoteAddress: address[1],
      headers: this._upgradeRequest.headers,
      referer: this._upgradeRequest.headers.referer
    }

    this._upgradeRequest = null

    const socketWrapper = createSocketWrapper(
      external, handshakeData, this._logger, this.options, this
    )
    uws.native.setUserData(external, socketWrapper)

    this._logger.info(
      EVENT.INCOMING_CONNECTION,
      `from ${handshakeData.referer} (${handshakeData.remoteAddress})`
    )

    let disconnectTimer
    if (this._unauthenticatedClientTimeout !== null) {
      disconnectTimer = setTimeout(
        this._processConnectionTimeout.bind(this, socketWrapper),
        this._unauthenticatedClientTimeout
      )
      socketWrapper.once('close', clearTimeout.bind(null, disconnectTimer))
    }

    socketWrapper.authCallback = this._authenticateConnection.bind(
      this,
      socketWrapper,
      disconnectTimer
    )
    socketWrapper.sendMessage({
      topic: TOPIC.CONNECTION,
      action: CONNECTION_ACTIONS.CHALLENGE
    }, false)
    socketWrapper.onMessage = this._processConnectionMessage.bind(this, socketWrapper)
  }

  /**
   * Always challenges the client that connects. This will be opened up later to allow users
   * to put in their own challenge authentication.
   */
  private _processConnectionMessage (socketWrapper: SocketWrapper, parsedMessages: Array<Message>) {
    const msg = parsedMessages[0]

    if (msg.parseError) {
      this._logger.warn(PARSER_ACTIONS[PARSER_ACTIONS.MESSAGE_PARSE_ERROR], `error parsing connection message ${msg.raw}`)
      socketWrapper.sendError({
        topic: TOPIC.CONNECTION
      }, PARSER_ACTIONS.MESSAGE_PARSE_ERROR, msg.raw)
      socketWrapper.destroy()
      return
    }

    if (msg.topic !== TOPIC.CONNECTION) {
      this._logger.warn(PARSER_ACTIONS[PARSER_ACTIONS.INVALID_MESSAGE], `invalid connection message ${msg.raw}`)
      socketWrapper.sendError({
        topic: TOPIC.CONNECTION,
      }, PARSER_ACTIONS.INVALID_MESSAGE, msg.raw)
      return
    }

    if (msg.action === CONNECTION_ACTIONS.CHALLENGE_RESPONSE) {
      socketWrapper.onMessage = socketWrapper.authCallback
      socketWrapper.sendMessage({
        topic: TOPIC.CONNECTION,
        action: CONNECTION_ACTIONS.ACCEPT
      })
      return
    }

    this._logger.error(PARSER_ACTIONS[PARSER_ACTIONS.UNKNOWN_ACTION], msg.action)
  }

  /**
   * Callback for the first message that's received from the socket.
   * This is expected to be an auth-message. This method makes sure that's
   * the case and - if so - forwards it to the permission handler for authentication
   */
  private _authenticateConnection (socketWrapper: SocketWrapper, disconnectTimeout, parsedMessages: Array<Message>): void {
    const msg = parsedMessages[0]

    let errorMsg

    if (msg.parseError) {
      this._logger.warn(PARSER_ACTIONS[PARSER_ACTIONS.MESSAGE_PARSE_ERROR], `error parsing auth message ${msg.raw}`)
      socketWrapper.sendError({
        topic: TOPIC.AUTH
      }, PARSER_ACTIONS.MESSAGE_PARSE_ERROR, msg.raw)
      socketWrapper.destroy()
      return
    }

    if (msg.topic !== TOPIC.AUTH) {
      this._logger.warn(PARSER_ACTIONS[PARSER_ACTIONS.INVALID_MESSAGE], `invalid auth message ${msg.raw}`)
      socketWrapper.sendError({
        topic: TOPIC.AUTH,
      }, PARSER_ACTIONS.INVALID_MESSAGE, msg.raw)
      return
    }

    /**
     * Log the authentication attempt
     */
    const logMsg = socketWrapper.getHandshakeData().remoteAddress
    this._logger.debug(AUTH_ACTIONS[AUTH_ACTIONS.REQUEST], logMsg)

    /**
     * Ensure the message is a valid authentication message
     */
    if (msg.action !== AUTH_ACTIONS.REQUEST) {
      errorMsg = this._logInvalidAuthData === true ? msg.data : ''
      this._sendInvalidAuthMsg(socketWrapper, errorMsg)
      return
    }

    /**
     * Ensure the authentication data is valid JSON
     */
    const result = socketWrapper.parseData(msg)
    if (result instanceof Error || !msg.parsedData || typeof msg.parsedData !== 'object') {
      errorMsg = 'Error parsing auth message'

      if (this._logInvalidAuthData === true) {
        errorMsg += ` "${msg.data}": ${result.toString()}`
      }

      this._sendInvalidAuthMsg(socketWrapper, errorMsg)
      return
    }

    /**
     * Forward for authentication
     */
    this._authenticationHandler.isValidUser(
      socketWrapper.getHandshakeData(),
      msg.parsedData,
      this._processAuthResult.bind(this, msg.parsedData, socketWrapper, disconnectTimeout)
    )
  }

  /**
   * Will be called for syntactically incorrect auth messages. Logs
   * the message, sends an error to the client and closes the socket
   */
  private _sendInvalidAuthMsg (socketWrapper: SocketWrapper, msg: string): void {
    this._logger.warn(AUTH_ACTIONS[AUTH_ACTIONS.INVALID_MESSAGE_DATA], this._logInvalidAuthData ? msg : '')
    socketWrapper.sendError({
      topic: TOPIC.AUTH
    }, AUTH_ACTIONS.INVALID_MESSAGE_DATA)
    socketWrapper.destroy()
  }

  /**
   * Callback for succesfully validated sockets. Removes
   * all authentication specific logic and registeres the
   * socket with the authenticated sockets
   */
  private _registerAuthenticatedSocket (socketWrapper: SocketWrapper, userData: any): void {
    delete socketWrapper.authCallback
    socketWrapper.once('close', this._onSocketClose.bind(this, socketWrapper))
    socketWrapper.onMessage = (parsedMessages) => {
      this.onMessages(socketWrapper, parsedMessages)
    }
    this._appendDataToSocketWrapper(socketWrapper, userData)

    socketWrapper.sendMessage({
      topic: TOPIC.AUTH,
      action: AUTH_ACTIONS.AUTH_SUCCESSFUL,
      parsedData: userData.clientData
    })

    if (socketWrapper.user !== OPEN) {
      this.emit('client-connected', socketWrapper)
    }

    this._authenticatedSockets.add(socketWrapper)
    this._logger.info(AUTH_ACTIONS[AUTH_ACTIONS.AUTH_SUCCESSFUL], socketWrapper.user)
  }

  /**
   * Append connection data to the socket wrapper
   */
  private _appendDataToSocketWrapper (socketWrapper: SocketWrapper, userData: any): void {
    socketWrapper.user = userData.username || OPEN
    socketWrapper.authData = userData.serverData || null
  }

  /**
   * Callback for invalid credentials. Will notify the client
   * of the invalid auth attempt. If the number of invalid attempts
   * exceed the threshold specified in options.maxAuthAttempts
   * the client will be notified and the socket destroyed.
   */
  private _processInvalidAuth (clientData: any, authData: any, socketWrapper: any): void {
    let logMsg = 'invalid authentication data'

    if (this._logInvalidAuthData === true) {
      logMsg += `: ${JSON.stringify(authData)}`
    }

    this._logger.info(AUTH_ACTIONS[AUTH_ACTIONS.AUTH_UNSUCCESSFUL], logMsg)
    socketWrapper.sendError({
      topic: TOPIC.AUTH,
      parsedData: clientData
    }, AUTH_ACTIONS.AUTH_UNSUCCESSFUL)
    socketWrapper.authAttempts++

    if (socketWrapper.authAttempts >= this._maxAuthAttempts) {
      this._logger.info(AUTH_ACTIONS[AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS], 'too many authentication attempts')
      socketWrapper.sendError({
        topic: TOPIC.AUTH
      }, AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS)
      socketWrapper.destroy()
    }
  }

  /**
   * Callback for connections that have not authenticated succesfully within
   * the expected timeframe
   */
  private _processConnectionTimeout (socketWrapper: SocketWrapper): void {
    const log = 'connection has not authenticated successfully in the expected time'
    this._logger.info(CONNECTION_ACTIONS[CONNECTION_ACTIONS.CONNECTION_AUTHENTICATION_TIMEOUT], log)
    socketWrapper.sendError({
      topic: TOPIC.CONNECTION
    }, CONNECTION_ACTIONS.CONNECTION_AUTHENTICATION_TIMEOUT)
    socketWrapper.destroy()
  }

  /**
   * Callback for the results returned by the permissionHandler
   */
  private _processAuthResult (authData: any, socketWrapper: SocketWrapper, disconnectTimeout, isAllowed: boolean, userData: any): void {
    userData = userData || {}
    clearTimeout(disconnectTimeout)

    if (isAllowed === true) {
      this._registerAuthenticatedSocket(socketWrapper, userData)
    } else {
      this._processInvalidAuth(userData.clientData, authData, socketWrapper)// todo
    }
  }

  /**
   * Generic callback for connection errors. This will most often be called
   * if the configured port number isn't available
   */
  private _onError (error: Error): void {
    this._logger.error(EVENT.CONNECTION_ERROR, error.toString())
  }

  /**
  * Notifies the (optional) onClientDisconnect method of the permissionHandler
  * that the specified client has disconnected
  */
  private _onSocketClose (socketWrapper: any):void {
    if (this._authenticationHandler.onClientDisconnect) {
      this._authenticationHandler.onClientDisconnect(socketWrapper.user)
    }

    if (socketWrapper.user !== OPEN) {
      this.emit('client-disconnected', socketWrapper)
    }

    // uws.native.clearUserData(socketWrapper._external)

    this._authenticatedSockets.delete(socketWrapper)
  }

  /**
   * HTTP upgrade request listener
   */
  private _onUpgradeRequest (request, socket):void {
    const requestPath = request.url.split('?')[0].split('#')[0]
    if (!this._urlPath || this._urlPath === requestPath) {
      this._handleUpgrade(request, socket)
    }
    UWSConnectionEndpoint._terminateSocket(socket, 400, 'URL not supported')
  }

  /**
   * Terminate an HTTP socket with some error code and error message
   */
  static _terminateSocket (socket, code:number, name:string):void {
    socket.end(`HTTP/1.1 ${code}  ${name}\r\n\r\n`)
  }

  /**
   * Process websocket upgrade
   */
  private _handleUpgrade (request, socket):void {
    const secKey = request.headers['sec-websocket-key']
    const socketHandle = socket.ssl ? socket._parent._handle : socket._handle
    const sslState = socket.ssl ? socket.ssl._external : null
    if (secKey && secKey.length === 24) {
      socket.setNoDelay(this._noDelay)
      const ticket = uws.native.transfer(
        socketHandle.fd === -1 ? socketHandle : socketHandle.fd,
        sslState
      )
      socket.on('close', () => {
        if (this._serverGroup) {
          this._upgradeRequest = request
          uws.native.upgrade(
            this._serverGroup,
            ticket, secKey,
            request.headers['sec-websocket-extensions'],
            request.headers['sec-websocket-protocol']
          )
        }
      })
    }
    socket.destroy()
  }

  /**
   * Closes the ws server connection. The ConnectionEndpoint
   * will emit a close event once succesfully shut down
   */
  public close () {
    this._server.removeAllListeners('request')
    this._server.removeAllListeners('upgrade')
    if (this._serverGroup) {
      uws.native.server.group.close(this._serverGroup)
    }
    this._serverGroup = null

    this._server.close(() => {
      this.emit('close')
    })
  }
}
