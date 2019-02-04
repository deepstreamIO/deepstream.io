/* eslint-disable class-methods-use-this */
const C = require('../../constants/constants')
const messageParser = require('../message-parser')
const messageBuilder = require('../message-builder')
const events = require('events')
const http = require('http')
const https = require('https')

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
module.exports = class ConnectionEndpoint extends events.EventEmitter {
  constructor (options) {
    super()
    this._options = options
    this.isReady = false
    this.initialised = false

    this._flushSockets = this._flushSockets.bind(this)
    this._flushTimeout = null
    this._scheduledSocketWrapperWrites = new Set()

    this._authenticatedSockets = new Set()
  }

  addHTTPListeners () {
  }

  createWebsocketServer () {
  }

  closeWebsocketServer () {
  }

  createWebsocketWrapper () {
  }

  onSocketWrapperClosed () {
  }

  /**
   * Called for every message that's received
   * from an authenticated socket
   *
   * This method will be overridden by an external class and is used instead
   * of an event emitter to improve the performance of the messaging pipeline
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {Array} messages the parsed messages as sent by the client
   *
   * @public
   *
   * @returns {void}
   */
  onMessages (socketWrapper, messages) { // eslint-disable-line
  }

  /**
   * Called on initialization with a reference to the instantiating deepstream server.
   *
   * @param {Deepstream} deepstream
   *
   * @public
   * @returns {Void}
   */
  setDeepstream (deepstream) {
    this._logger = deepstream._options.logger
    this._authenticationHandler = deepstream._options.authenticationHandler
    this._dsOptions = deepstream._options
  }

  /**
   * Initialise and setup the http and WebSocket servers.
   *
   * @throws Will throw if called before `setDeepstream()`.
   *
   * @public
   * @returns {Void}
   */
  init () {
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

    this._httpServer = this.createHttpServer()
    this._httpServer.on('request', this._handleHealthCheck.bind(this))
    this._httpServer.once('listening', this._onReady.bind(this))
    this._httpServer.on('error', this._onError.bind(this))
    this.addHTTPListeners(this._httpServer)

    this.websocketServer = this.createWebsocketServer()

    this._httpServer.listen(this._getOption('port'), this._getOption('host'))
  }

  /**
   * Called from a socketWrapper. This method tells the connection endpoint
   * to flush the socket after a certain amount of time, used to low priority
   * messages
   * @param  {SocketWrapper} socketWrapper SocketWrapper with a flush
   */
  scheduleFlush (socketWrapper) {
    this._scheduledSocketWrapperWrites.add(socketWrapper)
    if (!this._flushTimeout) {
      this._flushTimeout = setTimeout(this._flushSockets, this._options.outgoingBufferTimeout)
    }
  }

  /**
   * Called when the flushTimeout occurs in order to send  all pending socket acks
   */
  _flushSockets () {
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
   *
   * @private
   * @returns {Value} value
   */
  _getOption (option) {
    const value = this._dsOptions[option]
    if ((value === null || value === undefined) && (this._options[option] !== undefined)) {
      return this._options[option]
    }
    return value
  }

  /**
   * Called for the ready event of the ws server.
   *
   * @private
   * @returns {void}
   */
  _onReady () {
    const serverAddress = this._httpServer.address()
    const wsMsg = `Listening for websocket connections on ${serverAddress.address}:${serverAddress.port}${this._urlPath}`
    this._logger.info(C.EVENT.INFO, wsMsg)
    const hcMsg = `Listening for health checks on path ${this._healthCheckPath} `
    this._logger.info(C.EVENT.INFO, hcMsg)
    this.emit('ready')
    this.isReady = true
  }

  /**
   * Creates an HTTP or HTTPS server for ws to attach itself to,
   * depending on the options the client configured
   *
   * @private
   * @returns {http.HttpServer | http.HttpsServer}
   */
  createHttpServer () {
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
  _getHttpsParams () {
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

      const params = { key, cert }
      if (ca) {
        params.ca = ca
      }
      return params
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
  _handleHealthCheck (req, res) {
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
   * @private
   * @returns {void}
   */
  _onConnection (socketWrapper) {
    const handshakeData = socketWrapper.getHandshakeData()
    this._logger.info(
      C.EVENT.INCOMING_CONNECTION,
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

    socketWrapper.authCallBack = this._authenticateConnection.bind(
      this,
      socketWrapper,
      disconnectTimer
    )

    socketWrapper.sendMessage(C.TOPIC.CONNECTION, C.ACTIONS.CHALLENGE)
    socketWrapper.onMessage = this._processConnectionMessage.bind(this, socketWrapper)
    socketWrapper.socket.on('message', message => socketWrapper.onMessage(message))
    socketWrapper.socket.on('close', this._onSocketClose.bind(this, socketWrapper))
  }

  /**
   * Always challenges the client that connects. This will be opened up later to allow users
   * to put in their own challenge authentication, but requires more work on the clustering
   * aspect first.
   *
   * @param  {SocketWrapper} socketWrapper Socket
   * @param  {Message} connectionMessage Message recieved from server
   *
   * @private
   * @returns {void}
   */
  _processConnectionMessage (socketWrapper, connectionMessage) {
    if (typeof connectionMessage !== 'string') {
      this._logger.warn(
        C.EVENT.INVALID_MESSAGE,
        connectionMessage.toString()
      )
      socketWrapper.sendError(
        C.TOPIC.CONNECTION,
        C.EVENT.INVALID_MESSAGE,
        'invalid connection message'
      )
      return
    }

    const msg = messageParser.parse(connectionMessage)[0]

    if (msg === null || msg === undefined) {
      this._logger.warn(C.EVENT.MESSAGE_PARSE_ERROR, connectionMessage)
      socketWrapper.sendError(C.TOPIC.CONNECTION, C.EVENT.MESSAGE_PARSE_ERROR, connectionMessage)
      socketWrapper.close()
    } else if (msg.topic !== C.TOPIC.CONNECTION) {
      this._logger.warn(C.EVENT.INVALID_MESSAGE, `invalid connection message ${connectionMessage}`)
      socketWrapper.sendError(C.TOPIC.CONNECTION, C.EVENT.INVALID_MESSAGE, 'invalid connection message')
    } else if (msg.action === C.ACTIONS.PONG) {
      // do nothing
    } else if (msg.action === C.ACTIONS.CHALLENGE_RESPONSE) {
      socketWrapper.onMessage = socketWrapper.authCallBack
      socketWrapper.sendMessage(C.TOPIC.CONNECTION, C.ACTIONS.ACK)
    } else {
      this._logger.warn(C.EVENT.UNKNOWN_ACTION, msg.action)
      socketWrapper.sendError(C.TOPIC.CONNECTION, C.EVENT.UNKNOWN_ACTION, `unknown action ${msg.action}`)
    }
  }

  /**
   * Callback for the first message that's received from the socket.
   * This is expected to be an auth-message. This method makes sure that's
   * the case and - if so - forwards it to the permission handler for authentication
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {Timeout} disconnectTimeout
   * @param   {String} authMsg
   *
   * @private
   *
   * @returns {void}
   */
  _authenticateConnection (socketWrapper, disconnectTimeout, authMsg) {
    if (typeof authMsg !== 'string') {
      this._logger.warn(
        C.EVENT.INVALID_AUTH_MSG,
        authMsg.toString()
      )
      socketWrapper.sendError(
        C.TOPIC.AUTH,
        C.EVENT.INVALID_AUTH_MSG,
        'invalid authentication message'
      )
      return
    }

    const msg = messageParser.parse(authMsg)[0]
    let authData
    let errorMsg

    /**
     * Ignore pong messages
     */
    if (msg && msg.topic === C.TOPIC.CONNECTION && msg.action === C.ACTIONS.PONG) {
      return
    }

    /**
     * Log the authentication attempt
     */
    const logMsg = `${socketWrapper.getHandshakeData().remoteAddress}: ${authMsg}`
    this._logger.debug(C.EVENT.AUTH_ATTEMPT, logMsg)

    /**
     * Ensure the message is a valid authentication message
     */
    if (!msg ||
      msg.topic !== C.TOPIC.AUTH ||
      msg.action !== C.ACTIONS.REQUEST ||
      msg.data.length !== 1
    ) {
      errorMsg = this._logInvalidAuthData === true ? authMsg : ''
      this._sendInvalidAuthMsg(socketWrapper, errorMsg)
      return
    }

    /**
     * Ensure the authentication data is valid JSON
     */
    try {
      authData = this._getValidAuthData(msg.data[0])
    } catch (e) {
      errorMsg = 'Error parsing auth message'

      if (this._logInvalidAuthData === true) {
        errorMsg += ` "${authMsg}": ${e.toString()}`
      }

      this._sendInvalidAuthMsg(socketWrapper, errorMsg)
      return
    }

    /**
     * Forward for authentication
     */
    this._authenticationHandler.isValidUser(
      socketWrapper.getHandshakeData(),
      authData,
      this._processAuthResult.bind(this, authData, socketWrapper, disconnectTimeout)
    )
  }

  /**
   * Will be called for syntactically incorrect auth messages. Logs
   * the message, sends an error to the client and closes the socket
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {String} msg the raw message as sent by the client
   *
   * @private
   *
   * @returns {void}
   */
  _sendInvalidAuthMsg (socketWrapper, msg) {
    this._logger.warn(C.EVENT.INVALID_AUTH_MSG, this._logInvalidAuthData ? msg : '')
    socketWrapper.sendError(C.TOPIC.AUTH, C.EVENT.INVALID_AUTH_MSG, 'invalid authentication message')
    socketWrapper.close()
  }

  /**
   * Callback for succesfully validated sockets. Removes
   * all authentication specific logic and registeres the
   * socket with the authenticated sockets
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {String} username
   *
   * @private
   *
   * @returns {void}
   */
  _registerAuthenticatedSocket (socketWrapper, userData) {
    delete socketWrapper.authCallBack
    socketWrapper.onMessage = (message) => {
      const parsedMessages = messageParser.parse(message)
      this.onMessages(socketWrapper, parsedMessages)
    }
    this._appendDataToSocketWrapper(socketWrapper, userData)
    if (typeof userData.clientData === 'undefined') {
      socketWrapper.sendMessage(C.TOPIC.AUTH, C.ACTIONS.ACK)
    } else {
      socketWrapper.sendMessage(
        C.TOPIC.AUTH,
        C.ACTIONS.ACK,
        [messageBuilder.typed(userData.clientData)]
      )
    }

    if (socketWrapper.user !== OPEN) {
      this.emit('client-connected', socketWrapper)
    }

    this._authenticatedSockets.add(socketWrapper)
    this._logger.info(C.EVENT.AUTH_SUCCESSFUL, socketWrapper.user)
  }

  /**
   * Append connection data to the socket wrapper
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {Object} userData the data to append to the socket wrapper
   *
   * @private
   *
   * @returns {void}
   */
  _appendDataToSocketWrapper (socketWrapper, userData) { // eslint-disable-line
    socketWrapper.user = userData.username || OPEN
    socketWrapper.authData = userData.serverData || null
  }

  /**
   * Callback for invalid credentials. Will notify the client
   * of the invalid auth attempt. If the number of invalid attempts
   * exceed the threshold specified in options.maxAuthAttempts
   * the client will be notified and the socket destroyed.
   *
   * @param   {Object} authData the (invalid) auth data
   * @param   {SocketWrapper} socketWrapper
   *
   * @private
   *
   * @returns {void}
   */
  _processInvalidAuth (clientData, authData, socketWrapper) {
    let logMsg = 'invalid authentication data'

    if (this._logInvalidAuthData === true) {
      logMsg += `: ${JSON.stringify(authData)}`
    }

    this._logger.info(C.EVENT.INVALID_AUTH_DATA, logMsg)
    socketWrapper.sendError(
      C.TOPIC.AUTH,
      C.EVENT.INVALID_AUTH_DATA,
      messageBuilder.typed(clientData)
    )
    socketWrapper.authAttempts++

    if (socketWrapper.authAttempts >= this._maxAuthAttempts) {
      this._logger.info(C.EVENT.TOO_MANY_AUTH_ATTEMPTS, 'too many authentication attempts')
      socketWrapper.sendError(C.TOPIC.AUTH, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, messageBuilder.typed('too many authentication attempts'))
      socketWrapper.close()
    }
  }

  /**
   * Callback for connections that have not authenticated succesfully within
   * the expected timeframe
   *
   * @param   {SocketWrapper} socketWrapper
   *
   * @private
   *
   * @returns {void}
   */
  _processConnectionTimeout (socketWrapper) {
    const log = 'connection has not authenticated successfully in the expected time'
    this._logger.info(C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT, log)
    socketWrapper.sendError(
      C.TOPIC.CONNECTION,
      C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT,
      messageBuilder.typed(log)
    )
    socketWrapper.close()
  }

  /**
   * Callback for the results returned by the permissionHandler
   *
   * @param   {Object} authData
   * @param   {SocketWrapper} socketWrapper
   * @param   {Boolean} isAllowed
   * @param   {Object} userData
   *
   * @private
   *
   * @returns {void}
   */
  _processAuthResult (authData, socketWrapper, disconnectTimeout, isAllowed, userData) {
    userData = userData || {} // eslint-disable-line
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
   *
   * @param   {String} error
   *
   * @private
   * @returns {void}
   */
  _onError (error) {
    this._logger.error(C.EVENT.CONNECTION_ERROR, error.toString())
  }

  /**
   * Notifies the (optional) onClientDisconnect method of the permissionHandler
   * that the specified client has disconnected
   *
   * @param {SocketWrapper} socketWrapper
   *
   * @private
   * @returns {void}
   */
  _onSocketClose (socketWrapper) {
    if (this._authenticationHandler.onClientDisconnect) {
      this._authenticationHandler.onClientDisconnect(socketWrapper.user)
    }

    this._authenticatedSockets.delete(socketWrapper)
    this._scheduledSocketWrapperWrites.delete(socketWrapper)

    if (socketWrapper.user !== OPEN) {
      this.emit('client-disconnected', socketWrapper)
    }

    this.onSocketWrapperClosed(socketWrapper)
  }

  /**
   * Checks for authentication data and throws if null or not well formed
   *
   * @throws Will throw an error on invalid auth data
   *
   * @private
   * @returns {void}
   */
  _getValidAuthData (authData) { // eslint-disable-line
    const parsedData = JSON.parse(authData)
    if (parsedData === null || parsedData === undefined || typeof parsedData !== 'object') {
      throw new Error(`invalid authentication data ${authData}`)
    }
    return parsedData
  }

  /**
   * Closes the ws server connection. The ConnectionEndpoint
   * will emit a close event once succesfully shut down
   * @public
   * @returns {void}
   */
  close () {
    this._httpServer.removeAllListeners('request')
    this._httpServer.close(() => this.emit('close'))
    this.closeWebsocketServer()
  }
}
