const C = require('../constants/constants')
const messageParser = require('./message-parser')
const messageBuilder = require('./message-builder')
const SocketWrapper = require('./socket-wrapper')
const events = require('events')
const http = require('http')
const uws = require('uws')

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
module.exports = class UWSConnectionEndpoint extends events.EventEmitter {
  constructor (options) {
    super()
    this._options = options
    this.isReady = false
    this.description = 'µWebSocket Connection Endpoint'
    this.initialised = false
    this._authenticatedSockets = new Set()
    this._logger = options.logger
    this._authenticationHandler = options.authenticationHandler

    this._healthCheckPath = this._options.healthCheckPath
    this._maxAuthAttempts = this._options.maxAuthAttempts
    this._logInvalidAuthData = this._options.logInvalidAuthData
    this._urlPath = this._options.urlPath
    this._unauthenticatedClientTimeout = this._options.unauthenticatedClientTimeout

    this._uwsInit()

    this._server = http.createServer()
    this._server.on('request', this._handleHealthCheck.bind(this))
    this._server.once('listening', this._onReady.bind(this))
    this._server.on('error', this._onError.bind(this))
    this._server.on('upgrade', this._onUpgradeRequest.bind(this))

    this._server.listen(this._options.port, this._options.host)
  }

  /**
   * Initialize the uws endpoint, setup callbacks etc.
   *
   * @private
   * @returns {void}
   */
  _uwsInit () {
    const maxMessageSize = this._options.maxMessageSize
    this._serverGroup = uws.native.server.group.create(0, maxMessageSize)

    this._noDelay = this._options.noDelay

    uws.native.server.group.onDisconnection(
      this._serverGroup,
      (external, code, message, socketWrapper) => {
        if (socketWrapper) {
          socketWrapper.close()
        }
      }
    )

    uws.native.server.group.onMessage(this._serverGroup, (message, socketWrapper) => {
      socketWrapper.onMessage(message)
    })

    uws.native.server.group.onPing(this._serverGroup, () => {})
    uws.native.server.group.onPong(this._serverGroup, () => {})
    uws.native.server.group.onConnection(this._serverGroup, this._onConnection.bind(this))

    uws.native.server.group.startAutoPing(
      this._serverGroup,
      this._options.heartbeatInterval,
      messageBuilder.getMsg(C.TOPIC.CONNECTION, C.ACTIONS.PING)
    )
  }

  /**
   * Called for the ready event of the ws server.
   *
   * @private
   * @returns {void}
   */
  _onReady () {
    const serverAddress = this._server.address()
    const address = serverAddress.address
    const port = serverAddress.port
    const wsMsg = `listening for websocket connections on ${address}:${port}${this._urlPath}`
    this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, wsMsg)
    this.emit('ready')
    this.isReady = true
  }

  /**
   * Called for every message that's received
   * from an authenticated socket
   *
   * This method will be overridden by an external class and is used instead
   * of an event emitter to improve the performance of the messaging pipeline
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {String} message the parsed message as sent by the client
   *
   * @public
   *
   * @returns {void}
   */
  onMessage (socketWrapper, message) { // eslint-disable-line
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
   * @param {WebSocket} external    uws native websocket
   *
   * @private
   * @returns {void}
   */
  _onConnection (external) {
    const address = uws.native.getAddress(external)
    const handshakeData = {
      remoteAddress: address[1],
      headers: this._upgradeRequest.headers,
      referer: this._upgradeRequest.headers.referer
    }

    this._upgradeRequest = null

    const socketWrapper = new SocketWrapper(
      external, handshakeData, this._logger, this._options, this
    )
    uws.native.setUserData(external, socketWrapper)

    this._logger.log(
      C.LOG_LEVEL.INFO,
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
      this._logger.log(
        C.LOG_LEVEL.WARN,
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
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PARSE_ERROR, connectionMessage)
      socketWrapper.sendError(C.TOPIC.CONNECTION, C.EVENT.MESSAGE_PARSE_ERROR, connectionMessage)
      socketWrapper.destroy()
    } else if (msg.topic !== C.TOPIC.CONNECTION) {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE, `invalid connection message ${connectionMessage}`)
      socketWrapper.sendError(C.TOPIC.CONNECTION, C.EVENT.INVALID_MESSAGE, 'invalid connection message')
    } else if (msg.action === C.ACTIONS.PONG) {
      // do nothing
    } else if (msg.action === C.ACTIONS.CHALLENGE_RESPONSE) {
      socketWrapper.onMessage = socketWrapper.authCallBack
      socketWrapper.sendMessage(C.TOPIC.CONNECTION, C.ACTIONS.ACK)
    } else {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, msg.action)
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
      this._logger.log(
        C.LOG_LEVEL.WARN,
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
    this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.AUTH_ATTEMPT, logMsg)

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
    this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_AUTH_MSG, this._logInvalidAuthData ? msg : '')
    socketWrapper.sendError(C.TOPIC.AUTH, C.EVENT.INVALID_AUTH_MSG, 'invalid authentication message')
    socketWrapper.destroy()
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
    socketWrapper.once('close', this._onSocketClose.bind(this, socketWrapper))
    socketWrapper.onMessage = (msg) => this.onMessage(socketWrapper, msg)
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
    this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.AUTH_SUCCESSFUL, socketWrapper.user)
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

    this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.INVALID_AUTH_DATA, logMsg)
    socketWrapper.sendError(
      C.TOPIC.AUTH,
      C.EVENT.INVALID_AUTH_DATA,
      messageBuilder.typed(clientData)
    )
    socketWrapper.authAttempts++

    if (socketWrapper.authAttempts >= this._maxAuthAttempts) {
      this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, 'too many authentication attempts')
      socketWrapper.sendError(C.TOPIC.AUTH, C.EVENT.TOO_MANY_AUTH_ATTEMPTS, messageBuilder.typed('too many authentication attempts'))
      socketWrapper.destroy()
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
    this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT, log)
    socketWrapper.sendError(
      C.TOPIC.CONNECTION,
      C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT,
      messageBuilder.typed(log)
    )
    socketWrapper.destroy()
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
    this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.CONNECTION_ERROR, error.toString())
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

    if (socketWrapper.user !== OPEN) {
      this.emit('client-disconnected', socketWrapper)
    }

    uws.native.clearUserData(socketWrapper._external)
    this._authenticatedSockets.delete(socketWrapper)
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
   * HTTP upgrade request listener
   *
   * @param {Request} request
   * @param {Socket}  socket
   *
   * @private
   * @returns {void}
   */
  _onUpgradeRequest (request, socket) {
    const requestPath = request.url.split('?')[0].split('#')[0]
    if (!this._urlPath || this._urlPath === requestPath) {
      this._handleUpgrade(request, socket)
    }
    UWSConnectionEndpoint._terminateSocket(socket, 400, 'URL not supported')
  }

  /**
   * Terminate an HTTP socket with some error code and error message
   *
   * @param {Socket}  socket
   * @param {Number}  code
   * @param {String}  name
   *
   * @private
   * @returns {void}
   */
  static _terminateSocket (socket, code, name) {
    socket.end(`HTTP/1.1 ${code}  ${name}\r\n\r\n`)
  }

  /**
   * Process websocket upgrade
   *
   * @param {Request} request
   * @param {Socket}  socket
   *
   * @private
   * @returns {void}
   */
  _handleUpgrade (request, socket) {
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
   * @public
   * @returns {void}
   */
  close () {
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
