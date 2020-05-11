import JIFHandler from '../../jif/jif-handler'
import HTTPSocketWrapper from './socket-wrapper'
import * as HTTPStatus from 'http-status'
import { PARSER_ACTION, AUTH_ACTION, EVENT_ACTION, RECORD_ACTION, Message, ALL_ACTIONS, JSONObject } from '../../constants'
import { DeepstreamConnectionEndpoint, DeepstreamServices, SimpleSocketWrapper, SocketWrapper, JifResult, UnauthenticatedSocketWrapper, DeepstreamPlugin, DeepstreamConfig, EVENT, DeepstreamHTTPResponse, DeepstreamHTTPMeta, DeepstreamAuthenticationResult } from '@deepstream/types'
export interface HTTPEvents {
  onAuthMessage: Function
  onPostMessage: Function
  onGetMessage: Function
}

interface HTTPConnectionEndpointOptionsInterface {
  enableAuthEndpoint: boolean,
  authPath: string,
  postPath: string,
  getPath: string,
  allowAuthData: boolean,
  logInvalidAuthData: boolean,
  requestTimeout: number
}

function checkConfigOption (config: any, option: string, expectedType?: string): void {
  if ((expectedType && typeof config[option] !== expectedType) || config[option] === undefined) {
    throw new Error(`The HTTP plugin requires that the "${option}" config option is set`)
  }
}
export class HTTPConnectionEndpoint extends DeepstreamPlugin implements DeepstreamConnectionEndpoint {
  public description: string = 'HTTP connection endpoint'

  private initialized: boolean = false
  private jifHandler!: JIFHandler
  private onSocketMessageBound: Function
  private onSocketErrorBound: Function
  private logInvalidAuthData: boolean = false
  private requestTimeout!: number

  constructor (private pluginOptions: HTTPConnectionEndpointOptionsInterface, private services: DeepstreamServices, public dsOptions: DeepstreamConfig) {
    super()

    checkConfigOption(pluginOptions, 'enableAuthEndpoint', 'boolean')
    checkConfigOption(pluginOptions, 'authPath', 'string')
    checkConfigOption(pluginOptions, 'postPath', 'string')
    checkConfigOption(pluginOptions, 'getPath', 'string')

    this.onSocketMessageBound = this.onSocketMessage.bind(this)
    this.onSocketErrorBound = this.onSocketError.bind(this)
    this.onPermissionResponse = this.onPermissionResponse.bind(this)

    this.jifHandler = new JIFHandler(this.services)
  }

  public async whenReady (): Promise<void> {
    await this.services.httpService.whenReady()
  }

  public async close () {
  }

  public getClientVersions () {
    return {}
  }

  /**
   * Initialize the http server.
   */
  public init (): void {
    if (this.initialized) {
      throw new Error('init() must only be called once')
    }
    this.initialized = true

    if (this.pluginOptions.enableAuthEndpoint) {
      this.services.httpService.registerPostPathPrefix(this.pluginOptions.authPath, this.onAuthMessage.bind(this))
    }
    this.services.httpService.registerPostPathPrefix(this.pluginOptions.postPath, this.onPostMessage.bind(this))
    this.services.httpService.registerGetPathPrefix(this.pluginOptions.getPath, this.onGetMessage.bind(this))

    this.logInvalidAuthData = this.pluginOptions.logInvalidAuthData
    this.requestTimeout = this.pluginOptions.requestTimeout
    if (this.requestTimeout === undefined) {
      this.requestTimeout = 20000
    }
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

  private onGetMessage (meta: DeepstreamHTTPMeta, responseCallback: any) {
    const message = 'Reading records via HTTP GET is not yet implemented, please use a post request instead.'
    this.services.logger.warn(RECORD_ACTION[RECORD_ACTION.READ], message)
    responseCallback({ statusCode: 400, message })
    // TODO: implement a GET endpoint that reads the current state of a record
  }

  /**
   * Handle a message to the authentication endpoint (for token generation).
   *
   * Passes the entire message to the configured authentication handler.
   */
  private onAuthMessage (authData: JSONObject, metadata: DeepstreamHTTPMeta, responseCallback: DeepstreamHTTPResponse): void {
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
    metadata: DeepstreamHTTPMeta,
    responseCallback: DeepstreamHTTPResponse
  ): void {
    if (!Array.isArray(messageData.body) || messageData.body.length < 1) {
      const message = `Invalid message: the "body" parameter must ${
        messageData.body ? 'be a non-empty array of Objects.' : 'exist.'
      }`
      responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message })
      this.services.logger.warn(
        PARSER_ACTION[PARSER_ACTION.INVALID_MESSAGE],
        JSON.stringify(messageData.body)
      )
      return
    }

    let authData = {}
    if (messageData.authData !== undefined) {
      if (this.pluginOptions.allowAuthData !== true) {
        const message = 'Authentication using authData is disabled. Try using a token instead.'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message })
        this.services.logger.debug(
          AUTH_ACTION[AUTH_ACTION.INVALID_MESSAGE_DATA],
          'Auth rejected because allowAuthData was disabled'
        )
        return
      }
      if (messageData.authData === null || typeof messageData.authData !== 'object') {
        const message = 'Invalid message: the "authData" parameter must be an object'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message })
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
        const message = 'Invalid message: the "token" parameter must be a non-empty string'
        responseCallback({ statusCode: HTTPStatus.BAD_REQUEST, message })
        this.services.logger.debug(
          AUTH_ACTION[AUTH_ACTION.INVALID_MESSAGE_DATA],
          `auth token was not a string: ${
            this.logInvalidAuthData === true ? messageData.token : '-'
          }`
        )
        return
      }
      authData = { ...authData, token: messageData.token }
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
    authResponseData: DeepstreamAuthenticationResult,
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
    authResponseData?: DeepstreamAuthenticationResult
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
          errorEvent: EVENT.HTTP_REQUEST_TIMEOUT
        }
        numTimeouts++
      }
    }
    if (numTimeouts === 0) {
      return
    }

    this.services.logger.warn(EVENT.HTTP_REQUEST_TIMEOUT, 'HTTP Request timeout')

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
      socketWrapper,
      parsedMessage,
      this.onPermissionResponse,
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
