import { CONNECTION_ACTIONS, EVENT, TOPIC } from '../constants'

/**
 * The MessageProcessor consumes blocks of parsed messages emitted by the
 * ConnectionEndpoint, checks if they are permissioned and - if they
 * are - forwards them.
 */
export default class MessageProcessor {
  private _config: DeepstreamConfig
  private _services: DeepstreamServices

  constructor (config: DeepstreamConfig, services: DeepstreamServices) {
    this._config = config
    this._services = services
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
  process (socketWrapper: SocketWrapper, parsedMessages: Array<Message>): void {
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
        this._services.logger.warn(EVENT.MESSAGE_PARSE_ERROR, message)
        socketWrapper.sendError({
          topic: TOPIC.ERROR
        }, EVENT.MESSAGE_PARSE_ERROR, message)
        continue
      }

      if (message.isAck) {
        this._onPermissionResponse(socketWrapper, message, null, true)
        return
      }

      this._services.permissionHandler.canPerformAction(
        socketWrapper.user,
        message,
        this._onPermissionResponse.bind(this, socketWrapper, message),
        socketWrapper.authData,
        socketWrapper
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
  private _onPermissionResponse (socketWrapper: SocketWrapper, message: Message, error: Error | null, result: boolean): void {
    if (error !== null) {
      this._services.logger.warn(EVENT.MESSAGE_PERMISSION_ERROR, error.toString())
      socketWrapper.sendError(message, EVENT.MESSAGE_PERMISSION_ERROR)
      return
    }

    if (result !== true) {
      socketWrapper.sendError(message, EVENT.MESSAGE_DENIED)
      return
    }

    this.onAuthenticatedMessage(socketWrapper, message)
  }

}
