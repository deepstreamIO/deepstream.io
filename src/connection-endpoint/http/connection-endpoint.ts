import Server from './server'
import JIFHandler from '../../jif/jif-handler'
import HTTPSocketWrapper from './socket-wrapper'
import * as HTTPStatus from 'http-status'
import { PARSER_ACTION, AUTH_ACTION, EVENT_ACTION, RECORD_ACTION, Message, ALL_ACTIONS, JSONObject } from '../../constants'
import { DeepstreamConnectionEndpoint, DeepstreamServices, SimpleSocketWrapper, SocketWrapper, JifResult, UnauthenticatedSocketWrapper, DeepstreamPlugin, UserAuthData, DeepstreamConfig, EVENT } from '../../../ds-types/src/index'
import { EventEmitter } from 'events'

export class HTTPConnectionEndpoint extends DeepstreamPlugin implements DeepstreamConnectionEndpoint {
  public description: string = 'HTTP connection endpoint'

  private initialised: boolean = false
  private jifHandler!: JIFHandler
  private onSocketMessageBound: Function
  private onSocketErrorBound: Function
  private server!: Server
  private logInvalidAuthData: boolean = false
  private requestTimeout!: number

  private isReady: boolean = false
  private emitter = new EventEmitter()

  constructor (private options: any, private services: DeepstreamServices, public dsOptions: DeepstreamConfig) {
    super()

    this.onSocketMessageBound = this.onSocketMessage.bind(this)
    this.onSocketErrorBound = this.onSocketError.bind(this)
    this.onPermissionResponse = this.onPermissionResponse.bind(this)

    this.jifHandler = new JIFHandler(this.services)
  }

  public async whenReady (): Promise<void> {
    if (!this.isReady) {
      return new Promise((resolve) => this.emitter.once('ready', resolve))
    }
  }

  /**
   * Initialise the http server.
   */
  public init (): void {
    if (this.initialised) {
      throw new Error('init() must only be called once')
    }
    this.initialised = true

    const serverConfig = {
      port: this.getOption('port'),
      host: this.getOption('host'),
      healthCheckPath: this.getOption('healthCheckPath'),
      headers: this.getOption('headers'),
      authPath: this.options.authPath,
      postPath: this.options.postPath,
      getPath: this.options.getPath,
      allowAllOrigins: this.options.allowAllOrigins,
      enableAuthEndpoint: this.options.enableAuthEndpoint,
      maxMessageSize: this.options.maxMessageSize
    }
    this.server = new Server(serverConfig, this.services.logger)

    this.server.on('auth-message', this.onAuthMessage.bind(this))
    this.server.on('post-message', this.onPostMessage.bind(this))
    this.server.on('get-message', this.onGetMessage.bind(this))

    this.server.on('ready', () => {
      this.isReady = true
      this.emitter.emit('ready')
    })

    this.server.start()

    this.logInvalidAuthData = this.getOption('logInvalidAuthData') as boolean
    this.requestTimeout = this.getOption('requestTimeout') as number
    if (this.requestTimeout === undefined) {
      this.requestTimeout = 20000
    }
  }

  /**
   * Get a parameter from the root of the deepstream options if present, otherwise get it from the
   * plugin config.
   */
  private getOption (option: string): string | boolean | number {
    // @ts-ignore
    const value = this.dsOptions[option]
    if ((value === null || value === undefined) && (this.options[option] !== undefined)) {
      return this.options[option]
    }
    return value
  }

  public async close () {
    await this.server.stop()
  }

  /**
   * Called for every message that's received
   * from an authenticated socket
   *
   * This method will be overridden by an external class and is used instead
   * of an event emitter to improve the performance of the messaging pipeline
   */
  public onMessages (socketWrapper: SimpleSocketWrapper, messages: Message[]): void {
  }

  /**
   * Handle a message to the authentication endpoint (for token generation).
   *
   * Passes the entire message to the configured authentication handler.
   */
  private onAuthMessage (authData: JSONObject, metadata: object, responseCallback: Function): void {
    this.services.authentication.isValidUser(
      metadata,
      authData,
      (isAllowed, data) => {
        this.services.monitoring.onLogin(isAllowed, 'http')

        if (isAllowed === true) {
          responseCallback(null, {
            token: data!.token,
            clientData: data!.clientData
          })
          return
        }

        let error = typeof data === 'string' ? data : 'Invalid authentication data.'

        responseCallback({
          statusCode: HTTPStatus.UNAUTHORIZED,
          message: error
        })

        if (this.logInvalidAuthData === true) {
          error += `: ${JSON.stringify(authData)}`
        }

        this.services.logger.debug(AUTH_ACTION[AUTH_ACTION.AUTH_UNSUCCESSFUL], error)
      }
    )
  }

  /**
   * Handle a message to the POST endpoint
   *
   * Authenticates the message using authData, a token, or OPEN auth if enabled/provided.
   */
  private onPostMessage (
    messageData: { token?: string, authData?: object, body: object[] },
    metadata: object,
    responseCallback: Function
  ): void {
    if (!Array.isArray(messageData.body) || messageData.body.length < 1) {
      const error = `Invalid message: the "body" parameter must ${
        messageData.body ? 'be a non-empty array of Objects.' : 'exist.'
      }`
      responseCallback({
        statusCode: HTTPStatus.BAD_REQUEST,
        message: error
      })
      this.services.logger.warn(
        PARSER_ACTION[PARSER_ACTION.INVALID_MESSAGE],
        JSON.stringify(messageData.body)
      )
      return
    }
    let authData = {}
    if (messageData.authData !== undefined) {
      if (this.options.allowAuthData !== true) {
        const error = 'Authentication using authData is disabled. Try using a token instead.'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message: error })
        this.services.logger.debug(
          AUTH_ACTION[AUTH_ACTION.INVALID_MESSAGE_DATA],
          'Auth rejected because allowAuthData was disabled'
        )
        return
      }
      if (messageData.authData === null || typeof messageData.authData !== 'object') {
        const error = 'Invalid message: the "authData" parameter must be an object'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message: error })
        this.services.logger.debug(
          AUTH_ACTION[AUTH_ACTION.INVALID_MESSAGE_DATA],
          `authData was not an object: ${
            this.logInvalidAuthData === true ? JSON.stringify(messageData.authData) : '-'
          }`
        )
        return
      }
      authData = messageData.authData
    } else if (messageData.token !== undefined) {
      if (typeof messageData.token !== 'string' || messageData.token.length === 0) {
        const error = 'Invalid message: the "token" parameter must be a non-empty string'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message: error })
        this.services.logger.debug(
          AUTH_ACTION[AUTH_ACTION.INVALID_MESSAGE_DATA],
          `auth token was not a string: ${
            this.logInvalidAuthData === true ? messageData.token : '-'
          }`
        )
        return
      }
      authData = Object.assign({}, authData, { token: messageData.token })
    }

    this.services.authentication.isValidUser(
      metadata,
      authData,
      this.onMessageAuthResponse.bind(this, responseCallback, messageData)
    )
  }

  /**
   * Create and initialize a new SocketWrapper
   */
  private createSocketWrapper (
    authResponseData: object,
    messageIndex: number,
    messageResults: any,
    responseCallback: Function,
    requestTimeoutId: NodeJS.Timeout
  ): UnauthenticatedSocketWrapper {
    const socketWrapper = new HTTPSocketWrapper(
      this.services, this.onSocketMessageBound, this.onSocketErrorBound
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
   */
  private onMessageAuthResponse (
    responseCallback: Function,
    messageData: { body: object[] },
    success: boolean,
    authResponseData?: UserAuthData
  ): void {
    if (success !== true) {
      const error = typeof authResponseData === 'string' ? authResponseData : 'Unsuccessful authentication attempt.'
      responseCallback({
        statusCode: HTTPStatus.UNAUTHORIZED,
        message: error
      })
      return
    }
    const messageCount = messageData.body.length
    const messageResults = new Array(messageCount).fill(null)

    const parseResults = new Array(messageCount)
    for (let messageIndex = 0; messageIndex < messageCount; messageIndex++) {
      const parseResult = this.jifHandler.fromJIF(messageData.body[messageIndex])
      parseResults[messageIndex] = parseResult
      if (!parseResult.success) {
        const message = `Failed to parse JIF object at index ${messageIndex}.`
        responseCallback({
          statusCode: HTTPStatus.BAD_REQUEST,
          message: parseResult.error ? `${message} Reason: ${parseResult.error}` : message
        })
        this.services.logger.debug(PARSER_ACTION[PARSER_ACTION.MESSAGE_PARSE_ERROR], parseResult.error)
        return
      }
    }

    const requestTimeoutId = setTimeout(
      () => this.onRequestTimeout(responseCallback, messageResults),
      this.requestTimeout
    )

    // @ts-ignore
    const dummySocketWrapper = this.createSocketWrapper(authResponseData, null, null, null, null) as SocketWrapper

    for (let messageIndex = 0; messageIndex < messageCount; messageIndex++) {
      const parseResult = parseResults[messageIndex]
      if (parseResult.done) {
        // Messages such as event emits do not need to wait for a response. However, we need to
        // check that the message was successfully permissioned, so bypass the message-processor.
        this.permissionEventEmit(
          dummySocketWrapper, parseResult.message, messageResults, messageIndex
        )
        // check if a response can be sent immediately
        if (messageIndex === messageCount - 1) {
          HTTPConnectionEndpoint.checkComplete(messageResults, responseCallback, requestTimeoutId)
        }
      } else {
        const socketWrapper = this.createSocketWrapper(
          authResponseData!, messageIndex, messageResults, responseCallback, requestTimeoutId
        )

        /*
         * TODO: work out a way to safely enable socket wrapper pooling
         * if (this.socketWrapperPool.length === 0) {
         *   socketWrapper = new HTTPSocketWrapper(
         *     this.onSocketMessageBound,
         *     this.onSocketErrorBound
         *   )
         * } else {
         *   socketWrapper = this.socketWrapperPool.pop()
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
   */
  private onSocketMessage (
    messageResults: JifResult[], index: number, message: Message, responseCallback: Function, requestTimeoutId: NodeJS.Timer
  ): void {
    const parseResult = this.jifHandler.toJIF(message)
    if (!parseResult) {
      const errorMessage = `${message.topic} ${message.action} ${JSON.stringify(message.data)}`
      this.services.logger.error(PARSER_ACTION[PARSER_ACTION.MESSAGE_PARSE_ERROR], errorMessage)
      return
    }
    if (parseResult.done !== true) {
      return
    }
    if (messageResults[index] === null) {
      messageResults[index] = parseResult.message
      HTTPConnectionEndpoint.checkComplete(messageResults, responseCallback, requestTimeoutId)
    }
  }

  /**
   * Handle errors from deepstream socketWrappers and inserts message rejections into the HTTP
   * response where necessary.
   */
  private onSocketError (
    messageResults: JifResult[],
    index: number,
    message: Message,
    event: string,
    errorMessage: string,
    responseCallback: Function,
    requestTimeoutId: NodeJS.Timer
  ): void {
    const parseResult = this.jifHandler.errorToJIF(message, event)
    if (parseResult.done && messageResults[index] === null) {
      messageResults[index] = parseResult.message
      HTTPConnectionEndpoint.checkComplete(messageResults, responseCallback, requestTimeoutId)
    }
  }

  /**
   * Check whether any more responses are outstanding and finalize http response if not.
   */
  private static checkComplete (messageResults: JifResult[], responseCallback: Function, requestTimeoutId: NodeJS.Timer): void {
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
   */
  private onRequestTimeout (responseCallback: Function, messageResults: JifResult[]): void {
    let numTimeouts = 0
    for (let i = 0; i < messageResults.length; i++) {
      if (messageResults[i] === null) {
        messageResults[i] = {
          success: false,
          error: 'Request exceeded timeout before a response was received.',
          errorTopic: 'connection',
          errorEvent: EVENT.TIMEOUT
        }
        numTimeouts++
      }
    }
    if (numTimeouts === 0) {
      return
    }

    this.services.logger.warn(EVENT.TIMEOUT, 'HTTP Request timeout')

    const result = HTTPConnectionEndpoint.calculateMessageResult(messageResults)

    responseCallback(null, {
      result,
      body: messageResults
    })
  }

  /**
   * Calculate the 'result' field in a response depending on how many responses resolved
   * successfully. Can be one of 'SUCCESS', 'FAILURE' or 'PARTIAL SUCCSS'
   */
  private static calculateMessageResult (messageResults: JifResult[]): string | null {
    let numSucceeded = 0
    for (let i = 0; i < messageResults.length; i++) {
      if (!messageResults[i]) {
        // todo: when does this happen
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

  private onGetMessage (data: any, headers: any, responseCallback: any) {
    const message = 'Reading records via HTTP GET is not yet implemented, please use a post request instead.'
    this.services.logger.warn(RECORD_ACTION[RECORD_ACTION.READ], message)
    responseCallback({ statusCode: 400, message })
    // TODO: implement a GET endpoint that reads the current state of a record
  }

  /**
   * Permission an event emit and capture the response directly
   */
  private permissionEventEmit (
    socketWrapper: SocketWrapper,
    parsedMessage: Message,
    messageResults: JifResult[],
    messageIndex: number
  ): void {
    this.services.permission.canPerformAction(
      socketWrapper.user,
      parsedMessage,
      this.onPermissionResponse,
      socketWrapper.authData!,
      socketWrapper,
      { messageResults, messageIndex }
    )
  }

  /**
   * Handle an event emit permission response
   */
  private onPermissionResponse (
    socketWrapper: SocketWrapper,
    message: Message,
    { messageResults, messageIndex }: { messageResults: JifResult[], messageIndex: number },
    error: string | Error | ALL_ACTIONS | null,
    permissioned: boolean
  ): void {
    if (error !== null) {
      this.services.logger.warn(EVENT_ACTION[EVENT_ACTION.MESSAGE_PERMISSION_ERROR], error.toString())
    }
    if (permissioned !== true) {
      messageResults[messageIndex] = {
        success: false,
        error: 'Message denied. Action \'emit\' is not permitted.',
        errorEvent: EVENT_ACTION[EVENT_ACTION.MESSAGE_DENIED],
        errorAction: 'emit',
        errorTopic: 'event'
      }
      return
    }
    messageResults[messageIndex] = { success: true }
    this.services.messageDistributor.distribute(socketWrapper, message)
  }
}
