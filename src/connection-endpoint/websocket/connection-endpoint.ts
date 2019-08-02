
import { SocketConnectionEndpoint, SocketWrapper, DeepstreamServices, DeepstreamConfig, UnauthenticatedSocketWrapper, DeepstreamPlugin, ConnectionListener, EVENT } from '../../../ds-types/src/index'
import { EventEmitter } from 'events'
import { Message, ParseResult, PARSER_ACTION, TOPIC, CONNECTION_ACTION, ALL_ACTIONS, JSONObject, AUTH_ACTION } from '../../constants'

const OPEN = 'OPEN'

export interface WebSocketServerConfig {
  outgoingBufferTimeout: number,
  maxBufferByteSize: number,
  headers: string[],
  [index: string]: any,
}

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 */
export default class WebsocketConnectionEndpoint extends DeepstreamPlugin implements SocketConnectionEndpoint {
  public description: string = 'µWebSocket Connection Endpoint'

  private initialised: boolean = false
  private flushTimeout: NodeJS.Timeout | null = null
  private authenticatedSocketWrappers: Set<SocketWrapper> = new Set()
  private scheduledSocketWrapperWrites: Set<SocketWrapper> = new Set()
  private logInvalidAuthData: boolean = false
  private maxAuthAttempts: number = 3
  private unauthenticatedClientTimeout: number | boolean = false
  private urlPath: string | null = null
  private connectionListener!: ConnectionListener

  private isReady: boolean = false
  private emitter = new EventEmitter()

  constructor (private options: WebSocketServerConfig, protected services: DeepstreamServices, protected dsOptions: DeepstreamConfig) {
    super()
    this.flushSockets = this.flushSockets.bind(this)
  }

  public async whenReady (): Promise<void> {
    if (!this.isReady) {
      return new Promise((resolve) => this.emitter.once('ready', resolve))
    }
  }

  public createWebsocketServer () {
  }

  public closeWebsocketServer () {
  }

  public onSocketWrapperClosed (socketWrapper: SocketWrapper) {
  }

  public setConnectionListener (connectionListener: ConnectionListener) {
    this.connectionListener = connectionListener
  }

  /**
   * Called for every message that's received
   * from an authenticated socket
   *
   * This method will be overridden by an external class and is used instead
   * of an event emitter to improve the performance of the messaging pipeline
   */
  public onMessages (socketWrapper: SocketWrapper, messages: Message[]) {
  }

  /**
   * Initialise and setup the http and WebSocket servers.
   */
  public init (): void {
    if (this.initialised) {
      throw new Error('init() must only be called once')
    }
    this.initialised = true

    this.maxAuthAttempts = this.options.maxAuthAttempts
    this.logInvalidAuthData = this.options.logInvalidAuthData
    this.urlPath = this.options.urlPath
    this.unauthenticatedClientTimeout = this.options.unauthenticatedClientTimeout

    this.createWebsocketServer()
  }

  /**
   * Called from a socketWrapper. This method tells the connection endpoint
   * to flush the socket after a certain amount of time, used to low priority
   * messages
   */
  public scheduleFlush (socketWrapper: SocketWrapper) {
    this.scheduledSocketWrapperWrites.add(socketWrapper)
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(this.flushSockets, this.options.outgoingBufferTimeout)
    }
  }

  /**
   * Called when the flushTimeout occurs in order to send  all pending socket acks
   */
  private flushSockets () {
    for (const socketWrapper of this.scheduledSocketWrapperWrites) {
      socketWrapper.flush()
    }
    this.scheduledSocketWrapperWrites.clear()
    this.flushTimeout = null
  }

  /**
   * Get a parameter from the root of the deepstream options if present, otherwise get it from the
   * plugin config. If neither is present, default to the optionally provided default.
   */
  protected getOption (option: string) {
    return (this.dsOptions as any)[option] || this.options[option]
  }

  public handleParseErrors (socketWrapper: SocketWrapper, parseResults: ParseResult[]): Message[] {
    const messages: Message[] = []
    for (const parseResult of parseResults) {
      if (parseResult.parseError) {
        this.services.logger!.warn(PARSER_ACTION[PARSER_ACTION.MESSAGE_PARSE_ERROR], 'error parsing connection message')

        socketWrapper.sendMessage({
          topic: TOPIC.PARSER,
          action: parseResult.action,
          data: parseResult.raw,
          originalTopic: parseResult.parsedMessage.topic,
          originalAction: parseResult.parsedMessage.action
        })
        socketWrapper.destroy()
        continue
      }
      const message = parseResult as Message
      if (
          message.topic === TOPIC.CONNECTION &&
          message.action === CONNECTION_ACTION.PONG
      ) {
        continue
      }
      messages.push(message)
    }
    return messages
  }

  /**
   * Called for the ready event of the ws server.
   */
  protected onReady (): void {
    const wsMsg = `Listening for websocket connections on ${this.getOption('host')}:${this.getOption('port')}${this.urlPath}`
    this.services.logger.info(EVENT.INFO, wsMsg)
    const hcMsg = `Listening for health checks on path ${this.options.healthCheckPath} `
    this.services.logger.info(EVENT.INFO, hcMsg)
    this.emitter.emit('ready')
    this.isReady = true
  }

  /**
   * Receives a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user
   * and subscribes to authentication messages.
   */
  protected onConnection (socketWrapper: UnauthenticatedSocketWrapper) {
    const handshakeData = socketWrapper.getHandshakeData()
    this.services.logger!.info(
        EVENT.INCOMING_CONNECTION,
        `from ${handshakeData.referer} (${handshakeData.remoteAddress})`
    )

    let disconnectTimer

    if (this.unauthenticatedClientTimeout !== null && this.unauthenticatedClientTimeout !== false) {
      const timeout = this.unauthenticatedClientTimeout as any
      disconnectTimer = setTimeout(this.processConnectionTimeout.bind(this, socketWrapper), timeout)
      socketWrapper.onClose(clearTimeout.bind(null, disconnectTimer))
    }

    socketWrapper.authCallback = this.authenticateConnection.bind(
      this,
      socketWrapper,
      disconnectTimer
    )
    socketWrapper.onMessage = this.processConnectionMessage.bind(this, socketWrapper)
  }

  /**
   * Always challenges the client that connects. This will be opened up later to allow users
   * to put in their own challenge authentication.
   */
  private processConnectionMessage (socketWrapper: UnauthenticatedSocketWrapper, parsedMessages: Message[]) {
    const msg = parsedMessages[0]

    if (msg.topic !== TOPIC.CONNECTION) {
      this.services.logger!.warn(CONNECTION_ACTION[CONNECTION_ACTION.INVALID_MESSAGE], 'invalid connection message')
      socketWrapper.sendMessage({
        topic: TOPIC.CONNECTION,
        action: CONNECTION_ACTION.INVALID_MESSAGE,
        originalTopic: msg.topic,
        originalAction: msg.action
      })
      return
    }

    if (msg.action === CONNECTION_ACTION.CHALLENGE) {
      socketWrapper.onMessage = socketWrapper.authCallback!
      socketWrapper.sendMessage({
        topic: TOPIC.CONNECTION,
        action: CONNECTION_ACTION.ACCEPT
      })
      return
    }

    this.services.logger!.error(PARSER_ACTION[PARSER_ACTION.UNKNOWN_ACTION], '', msg.action)
  }

  /**
   * Callback for the first message that's received from the socket.
   * This is expected to be an auth-message. This method makes sure that's
   * the case and - if so - forwards it to the permission handler for authentication
   */
  private authenticateConnection (socketWrapper: UnauthenticatedSocketWrapper, disconnectTimeout: NodeJS.Timeout | undefined, parsedMessages: Message[]): void {
    const msg = parsedMessages[0]

    let errorMsg

    if (msg.topic !== TOPIC.AUTH) {
      this.services.logger!.warn(AUTH_ACTION[AUTH_ACTION.INVALID_MESSAGE], `invalid auth message: ${JSON.stringify(msg)}`)
      socketWrapper.sendMessage({
        topic: TOPIC.AUTH,
        action: AUTH_ACTION.INVALID_MESSAGE,
        originalTopic: msg.topic,
        originalAction: msg.action
      })
      return
    }

    /**
     * Log the authentication attempt
     */
    const logMsg = socketWrapper.getHandshakeData().remoteAddress
    this.services.logger!.debug(AUTH_ACTION[AUTH_ACTION.REQUEST], logMsg)

    /**
     * Ensure the message is a valid authentication message
     */
    if (msg.action !== AUTH_ACTION.REQUEST) {
      errorMsg = this.logInvalidAuthData === true ? JSON.stringify(msg.parsedData) : ''
      this.sendInvalidAuthMsg(socketWrapper, errorMsg, msg.action)
      return
    }

    /**
     * Ensure the authentication data is valid JSON
     */
    const result = socketWrapper.parseData(msg)
    if (result instanceof Error || !msg.parsedData || typeof msg.parsedData !== 'object') {
      errorMsg = 'Error parsing auth message'

      if (this.logInvalidAuthData === true) {
        errorMsg += ` "${msg.data}": ${result.toString()}`
      }

      this.sendInvalidAuthMsg(socketWrapper, errorMsg, msg.action)
      return
    }

    /**
     * Forward for authentication
     */
    this.services.authentication.isValidUser(
      socketWrapper.getHandshakeData(),
      msg.parsedData,
      this.processAuthResult.bind(this, msg.parsedData, socketWrapper, disconnectTimeout)
    )
  }

  /**
   * Will be called for syntactically incorrect auth messages. Logs
   * the message, sends an error to the client and closes the socket
   */
  private sendInvalidAuthMsg (socketWrapper: UnauthenticatedSocketWrapper, msg: string, originalAction: ALL_ACTIONS): void {
    this.services.logger!.warn(AUTH_ACTION[AUTH_ACTION.INVALID_MESSAGE_DATA], this.logInvalidAuthData ? msg : '')
    socketWrapper.sendMessage({
      topic: TOPIC.AUTH,
      action: AUTH_ACTION.INVALID_MESSAGE_DATA,
      originalAction
    })
    socketWrapper.destroy()
  }

  /**
   * Callback for succesfully validated sockets. Removes
   * all authentication specific logic and registeres the
   * socket with the authenticated sockets
   */
  private registerAuthenticatedSocket (unauthenticatedSocketWrapper: UnauthenticatedSocketWrapper, userData: any): void {
    const socketWrapper = this.appendDataToSocketWrapper(unauthenticatedSocketWrapper, userData)

    delete unauthenticatedSocketWrapper.authCallback
    unauthenticatedSocketWrapper.onMessage = (parsedMessages: Message[]) => {
      this.onMessages(socketWrapper, parsedMessages)
    }

    this.authenticatedSocketWrappers.add(socketWrapper)

    socketWrapper.sendMessage({
      topic: TOPIC.AUTH,
      action: AUTH_ACTION.AUTH_SUCCESSFUL,
      parsedData: userData.clientData
    })

    this.connectionListener.onClientConnected(socketWrapper)
    this.services.logger!.info(AUTH_ACTION[AUTH_ACTION.AUTH_SUCCESSFUL], socketWrapper.user!)
  }

  /**
   * Append connection data to the socket wrapper
   */
  private appendDataToSocketWrapper (socketWrapper: UnauthenticatedSocketWrapper, userData: any): SocketWrapper {
    const authenticatedSocketWrapper = socketWrapper as SocketWrapper
    authenticatedSocketWrapper.user = userData.username || OPEN
    authenticatedSocketWrapper.authData = userData.serverData || null
    authenticatedSocketWrapper.clientData = userData.clientData || null
    return authenticatedSocketWrapper
  }

  /**
   * Callback for invalid credentials. Will notify the client
   * of the invalid auth attempt. If the number of invalid attempts
   * exceed the threshold specified in options.maxAuthAttempts
   * the client will be notified and the socket destroyed.
   */
  private processInvalidAuth (clientData: JSONObject, authData: JSONObject, socketWrapper: UnauthenticatedSocketWrapper): void {
    let logMsg = 'invalid authentication data'

    if (this.logInvalidAuthData === true) {
      logMsg += `: ${JSON.stringify(authData)}`
    }

    this.services.logger!.info(AUTH_ACTION[AUTH_ACTION.AUTH_UNSUCCESSFUL], logMsg)
    socketWrapper.sendMessage({
      topic: TOPIC.AUTH,
      action: AUTH_ACTION.AUTH_UNSUCCESSFUL,
      parsedData: clientData
    })
    socketWrapper.authAttempts++

    if (socketWrapper.authAttempts >= this.maxAuthAttempts) {
      this.services.logger!.info(AUTH_ACTION[AUTH_ACTION.TOO_MANY_AUTH_ATTEMPTS], 'too many authentication attempts')
      socketWrapper.sendMessage({
        topic: TOPIC.AUTH,
        action: AUTH_ACTION.TOO_MANY_AUTH_ATTEMPTS
      })
      socketWrapper.destroy()
    }
  }

  /**
   * Callback for connections that have not authenticated succesfully within
   * the expected timeframe
   */
  private processConnectionTimeout (socketWrapper: UnauthenticatedSocketWrapper): void {
    const log = 'connection has not authenticated successfully in the expected time'
    this.services.logger!.info(CONNECTION_ACTION[CONNECTION_ACTION.AUTHENTICATION_TIMEOUT], log)
    socketWrapper.sendMessage({
      topic: TOPIC.CONNECTION,
      action: CONNECTION_ACTION.AUTHENTICATION_TIMEOUT
    })
    socketWrapper.destroy()
  }

  /**
   * Callback for the results returned by the permission service
   */
  private processAuthResult (authData: any, socketWrapper: UnauthenticatedSocketWrapper, disconnectTimeout: NodeJS.Timeout | undefined, isAllowed: boolean, userData: any): void {
    this.services.monitoring.onLogin(isAllowed, 'websocket')

    userData = userData || {}
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout)
    }

    if (isAllowed === true) {
      this.registerAuthenticatedSocket(socketWrapper, userData)
    } else {
      this.processInvalidAuth(userData.clientData, authData, socketWrapper)
    }
  }

  /**
   * Notifies the (optional) onClientDisconnect method of the permission
   * that the specified client has disconnected
   */
  protected onSocketClose (socketWrapper: any): void {
    this.scheduledSocketWrapperWrites.delete(socketWrapper)
    this.onSocketWrapperClosed(socketWrapper)

    if (this.authenticatedSocketWrappers.delete(socketWrapper)) {
      if (this.services.authentication.onClientDisconnect) {
        this.services.authentication.onClientDisconnect(socketWrapper.user)
      }

      this.connectionListener.onClientDisconnected(socketWrapper)
    }
  }

  /**
   * Closes the ws server connection. The ConnectionEndpoint
   * will emit a close event once succesfully shut down
   */
  public async close () {
    await this.closeWebsocketServer()
  }
}
