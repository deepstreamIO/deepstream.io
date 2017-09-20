'use strict'

const Server = require('./server')
const JIFHandler = require('../jif-handler')
const HTTPSocketWrapper = require('./socket-wrapper')
const HTTPStatus = require('http-status')
const events = require('events')

module.exports = class HTTPConnectionEndpoint extends events.EventEmitter {
  constructor (options) {
    super()
    this._options = options
    this.isReady = false
    this.description = 'HTTP connection endpoint'

    this._onSocketMessageBound = this._onSocketMessage.bind(this)
    this._onSocketErrorBound = this._onSocketError.bind(this)
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
    this._messageDistributor = deepstream._messageDistributor
    this._permissionHandler = deepstream._options.permissionHandler
    this._dsOptions = deepstream._options
    this._constants = deepstream.constants
    const jifHandlerOptions = {
      logger: deepstream._options.logger,
      buildMessage: deepstream._messageBuilder.getMsg,
      constants: deepstream.constants,
      toTyped: deepstream.toTyped,
      convertTyped: deepstream.convertTyped,
    }
    this._jifHandler = new JIFHandler(jifHandlerOptions)
  }

  /**
   * Initialise the http server.
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

    const serverConfig = {
      port: this._getOption('port'),
      host: this._getOption('host'),
      healthCheckPath: this._getOption('healthCheckPath'),
      authPath: this._options.authPath,
      postPath: this._options.postPath,
      getPath: this._options.getPath,
      allowAllOrigins: this._options.allowAllOrigins,
      enableAuthEndpoint: this._options.enableAuthEndpoint
    }
    this._server = new Server(serverConfig, this._constants, this._logger)

    this._server.on('auth-message', this._onAuthMessage.bind(this))
    this._server.on('post-message', this._onPostMessage.bind(this))
    this._server.on('get-message', this._onGetMessage.bind(this))

    this._server.on('ready', () => {
      this.isReady = true
      this.emit('ready')
    })

    this._server.start()

    this._logInvalidAuthData = this._getOption('logInvalidAuthData')
    this._requestTimeout = this._getOption('requestTimeout')
    if (this._requestTimeout === undefined) {
      this._requestTimeout = 20000
    }
  }

  /**
   * Get a parameter from the root of the deepstream options if present, otherwise get it from the
   * plugin config.
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

  close () {
    this._server.stop(() => this.emit('close'))
  }

  /**
   * Called for every message that's received
   * from an authenticated socket
   *
   * This method will be overridden by an external class and is used instead
   * of an event emitter to improve the performance of the messaging pipeline
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {Array}         messages      the parsed messages
   *
   * @public
   *
   * @returns {void}
   */
  onMessages (socketWrapper, messages) { // eslint-disable-line
  }

  /**
   * Handle a message to the authentication endpoint (for token generation).
   *
   * Passes the entire message to the configured authentication handler.
   *
   * @param   {Object}    authData
   * @param   {Object}    metadata          headers and other connection data
   * @param   {Function}  responseCallback
   *
   * @private
   *
   * @returns {void}
   */
  _onAuthMessage (authData, metadata, responseCallback) {
    this._authenticationHandler.isValidUser(
      metadata,
      authData,
      this._processAuthResult.bind(this, responseCallback, authData)
    )
  }

  /**
   * Handle response from authentication handler relating to an auth request.
   *
   * Builds a response containing the user's userData and token
   *
   * @param   {Function} responseCallback   callback for the entire request
   * @param   {Object}   authData
   * @param   {Boolean}  isAllowed
   * @param   {Object}   data
   *
   * @private
   *
   * @returns {void}
   */
  _processAuthResult (responseCallback, authData, isAllowed, data) {
    if (isAllowed === true) {
      responseCallback(null, {
        token: data.token,
        clientData: data.clientData
      })
      return
    }

    let error = typeof data === 'string' ? data : 'Invalid authentication data.'

    responseCallback({
      statusCode: HTTPStatus.UNAUTHORIZED,
      message: error
    })

    if (this._logInvalidAuthData === true) {
      error += `: ${JSON.stringify(authData)}`
    }

    const C = this._constants
    this._logger.debug(C.EVENT.INVALID_AUTH_DATA, error)

  }

  /**
   * Handle a message to the POST endpoint
   *
   * Authenticates the message using authData, a token, or OPEN auth if enabled/provided.
   *
   * @param   {Object}    messageData
   * @param   {Object}    metadata          headers and other connection data
   * @param   {Function}  responseCallback
   *
   * @private
   *
   * @returns {void}
   */
  _onPostMessage (messageData, metadata, responseCallback) {
    const C = this._constants
    if (!Array.isArray(messageData.body) || messageData.body.length < 1) {
      const error = `Invalid message: the "body" parameter must ${
        messageData.body ? 'be a non-empty array of Objects.' : 'exist.'
      }`
      responseCallback({
        statusCode: HTTPStatus.BAD_REQUEST,
        message: error
      })
      this._logger.debug(
        C.EVENT.INVALID_MESSAGE,
        JSON.stringify(messageData.body)
      )
      return
    }
    let authData = {}
    if (messageData.authData !== undefined) {
      if (this._options.allowAuthData !== true) {
        const error = 'Authentication using authData is disabled. Try using a token instead.'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message: error })
        this._logger.debug(
          C.EVENT.INVALID_AUTH_DATA,
          'Auth rejected because allowAuthData was disabled'
        )
        return
      }
      if (messageData.authData === null || typeof messageData.authData !== 'object') {
        const error = 'Invalid message: the "authData" parameter must be an object'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message: error })
        this._logger.debug(
          C.EVENT.INVALID_AUTH_DATA,
          `authData was not an object: ${
            this._logInvalidAuthData === true ? JSON.stringify(messageData.authData) : '-'
          }`
        )
        return
      }
      authData = messageData.authData
    } else if (messageData.token !== undefined) {
      if (typeof messageData.token !== 'string' || messageData.token.length === 0) {
        const error = 'Invalid message: the "token" parameter must be a non-empty string'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message: error })
        this._logger.debug(
          C.EVENT.INVALID_AUTH_DATA,
          `auth token was not a string: ${
            this._logInvalidAuthData === true ? messageData.token : '-'
          }`
        )
        return
      }
      authData.token = messageData.token
    }

    this._authenticationHandler.isValidUser(
      metadata,
      authData,
      this._onMessageAuthResponse.bind(this, responseCallback, messageData)
    )
  }

  /**
   * Create and initialize a new SocketWrapper
   *
   * @param   {Object}   authResponseData
   * @param   {Number}   messageIndex
   * @param   {Array}    messageResults
   * @param   {Function} responseCallback
   * @param   {Timeout}  requestTimeoutId
   *
   * @private
   *
   * @returns {void}
   */
  _createSocketWrapper (
    authResponseData, messageIndex, messageResults, responseCallback, requestTimeoutId
  ) {
    const socketWrapper = new HTTPSocketWrapper(
      {}, this._onSocketMessageBound, this._onSocketErrorBound
    )

    socketWrapper.init(
      authResponseData, messageIndex, messageResults, responseCallback, requestTimeoutId
    )
    return socketWrapper
  }

  /**
   * Handle response from authentication handler relating to a POST request.
   *
   * Parses, permissions and distributes the individual messages
   *
   * @param   {Function} responseCallback   callback for the entire request
   * @param   {Object}   authData
   * @param   {Boolean}  isAllowed
   * @param   {Object}   authResponseData
   *
   * @private
   *
   * @returns {void}
   */
  _onMessageAuthResponse (responseCallback, messageData, success, authResponseData) {
    if (success !== true) {
      const error = typeof authResponseData === 'string' ? authResponseData : 'Unsuccessful authentication attempt.'
      responseCallback({
        statusCode: HTTPStatus.UNAUTHORIZED,
        message: error
      })
      return
    }
    const C = this._constants

    const messageCount = messageData.body.length
    const messageResults = new Array(messageCount).fill(null)

    const parseResults = new Array(messageCount)
    for (let messageIndex = 0; messageIndex < messageCount; messageIndex++) {
      const parseResult = this._jifHandler.fromJIF(messageData.body[messageIndex])
      parseResults[messageIndex] = parseResult
      if (!parseResult.success) {
        const message = `Failed to parse JIF object at index ${messageIndex}.`
        responseCallback({
          statusCode: HTTPStatus.BAD_REQUEST,
          message: parseResult.error ? `${message} Reason: ${parseResult.error}` : message
        })
        this._logger.debug(C.EVENT.MESSAGE_PARSE_ERROR, parseResult.error)
        return
      }
    }

    const requestTimeoutId = setTimeout(
      () => this._onRequestTimeout(responseCallback, messageResults),
      this._requestTimeout
    )

    const dummySocketWrapper = this._createSocketWrapper(authResponseData)

    for (let messageIndex = 0; messageIndex < messageCount; messageIndex++) {
      const parseResult = parseResults[messageIndex]
      if (parseResult.done) {
        // Messages such as event emits do not need to wait for a response. However, we need to
        // check that the message was successfully permissioned, so bypass the message-processor.
        this._permissionEventEmit(
          dummySocketWrapper, parseResult.message, messageResults, messageIndex
        )
        // check if a response can be sent immediately
        if (messageIndex === messageCount - 1) {
          HTTPConnectionEndpoint._checkComplete(messageResults, responseCallback, requestTimeoutId)
        }
      } else {
        const socketWrapper = this._createSocketWrapper(
          authResponseData, messageIndex, messageResults, responseCallback, requestTimeoutId
        )

        /*
         * TODO: work out a way to safely enable socket wrapper pooling
         * if (this._socketWrapperPool.length === 0) {
         *   socketWrapper = new HTTPSocketWrapper(
         *     this._onSocketMessageBound,
         *     this._onSocketErrorBound
         *   )
         * } else {
         *   socketWrapper = this._socketWrapperPool.pop()
         * }
         */

        // emit the message
        this.onMessages(socketWrapper, [parseResult.message])
      }
    }
  }

  /**
   * Handle messages from deepstream socketWrappers and inserts message responses into the HTTP
   * response where possible.
   *
   * @param   {Array}     messageResults   array of all results
   * @param   {Number}    index            result index corresponding to socketWrapper
   * @param   {String}    topic
   * @param   {String}    action
   * @param   {Array}    data
   * @param   {Function}  responseCallback
   * @param   {Number}    requestTimeoutId
   *
   * @private
   *
   * @returns {void}
   */
  _onSocketMessage (
    messageResults, index, topic, action, data, responseCallback, requestTimeoutId
  ) {
    const parseResult = this._jifHandler.toJIF(topic, action, data)
    if (!parseResult) {
      const C = this._constants
      const message = `${topic} ${action} ${JSON.stringify(data)}`
      this._logger.error(C.EVENT.MESSAGE_PARSE_ERROR, message)
      return
    }
    if (parseResult.done !== true) {
      return
    }
    if (messageResults[index] === null) {
      messageResults[index] = parseResult.message
      HTTPConnectionEndpoint._checkComplete(messageResults, responseCallback, requestTimeoutId)
    }
  }

  /**
   * Handle errors from deepstream socketWrappers and inserts message rejections into the HTTP
   * response where necessary.
   *
   * @param   {Array}     messageResults   array of all results
   * @param   {Number}    index            result index corresponding to socketWrapper
   * @param   {String}    topic
   * @param   {String}    event
   * @param   {Array}     message
   * @param   {Function}  responseCallback
   * @param   {Number}    requestTimeoutId
   *
   * @private
   *
   * @returns {void}
   */
  _onSocketError (
    messageResults, index, topic, event, message, responseCallback, requestTimeoutId
  ) {
    const parseResult = this._jifHandler.errorToJIF(topic, event, message)
    if (parseResult.done && messageResults[index] === null) {
      messageResults[index] = parseResult.message
      HTTPConnectionEndpoint._checkComplete(messageResults, responseCallback, requestTimeoutId)
    }
  }

  /**
   * Check whether any more responses are outstanding and finalize http response if not.
   *
   * @param   {Array}     messageResults   array of all results
   * @param   {Function}  responseCallback
   * @param   {Number}    requestTimeoutId
   *
   * @private
   *
   * @returns {void}
   */
  static _checkComplete (messageResults, responseCallback, requestTimeoutId) {
    const messageResult = HTTPConnectionEndpoint.calculateMessageResult(messageResults)
    if (messageResult === null) {
      // insufficient responses received
      return
    }

    clearTimeout(requestTimeoutId)

    responseCallback(null, {
      result: messageResult,
      body: messageResults
    })
  }

  /**
   * Handle request timeout, sending any responses that have already resolved.
   *
   * @param   {Function}  responseCallback
   * @param   {Array}     messageResults   array of all results
   *
   * @private
   *
   * @returns {void}
   */
  _onRequestTimeout (responseCallback, messageResults) {
    const C = this._constants

    let numTimeouts = 0
    for (let i = 0; i < messageResults.length; i++) {
      if (messageResults[i] === null) {
        messageResults[i] = {
          success: false,
          error: 'Request exceeded timeout before a response was received.',
          errorTopic: 'connection',
          errorEvent: C.EVENT.TIMEOUT
        }
        numTimeouts++
      }
    }
    if (numTimeouts === 0) {
      return
    }

    this._logger.warn(C.EVENT.TIMEOUT, 'HTTP Request timeout')

    const result = HTTPConnectionEndpoint.calculateMessageResult(messageResults)

    responseCallback(null, {
      result,
      body: messageResults
    })
  }

  /**
   * Calculate the 'result' field in a response depending on how many responses resolved
   * successfully. Can be one of 'SUCCESS', 'FAILURE' or 'PARTIAL SUCCSS'
   *
   * @param   {Array}     messageResults   array of all results
   *
   * @private
   *
   * @returns {void}
   */
  static calculateMessageResult (messageResults) {
    let numSucceeded = 0
    for (let i = 0; i < messageResults.length; i++) {
      if (!messageResults[i]) {
        return null
      }
      if (messageResults[i].success) {
        numSucceeded++
      }
    }

    if (numSucceeded === messageResults.length) {
      return 'SUCCESS'
    }
    if (numSucceeded === 0) {
      return 'FAILURE'
    }
    return 'PARTIAL_SUCCESS'
  }

  // eslint-disable-next-line
  _onGetMessage (data, headers, responseCallback) {
    // TODO: implement a GET endpoint that reads the current state of a record
  }

  /**
   * Permission an event emit and capture the response directly
   *
   * @param   {HTTPSocketWrapper} socketWrapper
   * @param   {Object}            parsedMessage
   * @param   {Array}             messageResults  array of all results
   * @param   {Number}            messageIndex
   *
   * @private
   *
   * @returns {void}
   */
  _permissionEventEmit (socketWrapper, parsedMessage, messageResults, messageIndex) {
    this._permissionHandler.canPerformAction(
      socketWrapper.user,
      parsedMessage,
      this._onPermissionResponse.bind(
        this, socketWrapper, parsedMessage, messageResults, messageIndex
      ),
      socketWrapper.authData
    )
  }

  /**
   * Handle an event emit permission response
   *
   * @param   {HTTPSocketWrapper} socketWrapper
   * @param   {Object}            message
   * @param   {Array}             messageResults  array of all results
   * @param   {Number}            messageIndex
   * @param   {Error}             error
   * @param   {Boolean}           permissioned
   *
   * @private
   *
   * @returns {void}
   */
  _onPermissionResponse (
    socketWrapper, message, messageResults, messageIndex, error, permissioned
  ) {
    const C = this._constants
    if (error !== null) {
      this._options.logger.warn(C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString())
    }
    if (permissioned !== true) {
      messageResults[messageIndex] = {
        success: false,
        error: 'Message denied. Action \'emit\' is not permitted.',
        errorEvent: C.EVENT.MESSAGE_DENIED,
        errorAction: 'emit',
        errorTopic: 'event'
      }
      return
    }
    messageResults[messageIndex] = { success: true }
    this._messageDistributor.distribute(socketWrapper, message)
  }
}
