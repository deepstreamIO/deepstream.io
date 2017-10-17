import { AUTH_ACTIONS, CONNECTION_ACTIONS, EVENT, PARSER_ACTIONS, TOPIC } from '../constants'

/**
 * The MessageProcessor consumes blocks of parsed messages emitted by the
 * ConnectionEndpoint, checks if they are permissioned and - if they
 * are - forwards them.
 */
export default class MessageProcessor {
  private config: DeepstreamConfig
  private services: DeepstreamServices

  constructor (config: DeepstreamConfig, services: DeepstreamServices) {
    this.config = config
    this.services = services
  }

  /**
   * There will only ever be one consumer of forwarded messages. So rather than using
   * events - and their performance overhead - the messageProcessor exposes
   * this method that's expected to be overwritten.
   */
  public onAuthenticatedMessage (socketWrapper: SocketWrapper, message: Message) {
  }

  /**
   * This method is the way the message processor accepts input. It receives arrays
   * of parsed messages, iterates through them and issues permission requests for
   * each individual message
   *
   * @todo The responses from the permissionHandler might arive in any arbitrary order - order them
   * @todo Handle permission handler timeouts
   */
  public process (socketWrapper: SocketWrapper, parsedMessages: Array<Message>): void {
    let message

    const length = parsedMessages.length
    for (let i = 0; i < length; i++) {
      message = parsedMessages[i]

      if (message.topic === TOPIC.CONNECTION && message.action === CONNECTION_ACTIONS.PONG) {
        continue
      }

      if (message === null ||
        !message.action ||
        !message.topic) {
        this.services.logger.warn(PARSER_ACTIONS[PARSER_ACTIONS.MESSAGE_PARSE_ERROR], message)
        socketWrapper.sendError({
          topic: TOPIC.ERROR,
        }, PARSER_ACTIONS.MESSAGE_PARSE_ERROR, message)
        continue
      }

      this.services.permissionHandler.canPerformAction(
        socketWrapper.user,
        message,
        this.onPermissionResponse.bind(this, socketWrapper, message),
        socketWrapper.authData,
        socketWrapper,
      )
    }
  }

  /**
   * Processes the response that's returned by the permissionHandler.
   *
   * @param   {SocketWrapper}   socketWrapper
   * @param   {Object} message  parsed message - might have been manipulated
   *                              by the permissionHandler
   * @param   {Error} error     error or null if no error. Denied permissions will be expressed
   *                            by setting result to false
   * @param   {Boolean} result    true if permissioned
   */
  private onPermissionResponse (socketWrapper: SocketWrapper, message: Message, error: Error | null, result: boolean): void {
    if (error !== null) {
      this.services.logger.warn(AUTH_ACTIONS[AUTH_ACTIONS.MESSAGE_PERMISSION_ERROR], error.toString())
      socketWrapper.sendError(message, AUTH_ACTIONS.MESSAGE_PERMISSION_ERROR)
      return
    }

    if (result !== true) {
      socketWrapper.sendError(message, AUTH_ACTIONS.MESSAGE_DENIED)
      return
    }

    this.onAuthenticatedMessage(socketWrapper, message)
  }

}
