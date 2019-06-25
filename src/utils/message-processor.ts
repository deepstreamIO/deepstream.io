import { EVENT_ACTIONS } from '../constants'
import { TOPIC, CONNECTION_ACTIONS, Message, ALL_ACTIONS } from '../../binary-protocol/src/message-constants'
import { SocketWrapper, DeepstreamConfig, DeepstreamServices } from '../types'

/**
 * The MessageProcessor consumes blocks of parsed messages emitted by the
 * ConnectionEndpoint, checks if they are permissioned and - if they
 * are - forwards them.
 */
export default class MessageProcessor {
  constructor (config: DeepstreamConfig, private services: DeepstreamServices) {
    this.onPermissionResponse = this.onPermissionResponse.bind(this)
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
   * @todo The responses from the permission service might arrive in any arbitrary order - order them
   * @todo Handle permission handler timeouts
   */
  public process (socketWrapper: SocketWrapper, parsedMessages: Message[]): void {
    let message

    const length = parsedMessages.length
    for (let i = 0; i < length; i++) {
      message = parsedMessages[i]

      if (message.topic === TOPIC.CONNECTION && message.action === CONNECTION_ACTIONS.PING) {
        // Each connection endpoint is responsible for dealing with ping connections
        continue
      }

      this.services.permission.canPerformAction(
        socketWrapper.user,
        message,
        this.onPermissionResponse,
        socketWrapper.authData!,
        socketWrapper,
        {}
      )
    }
  }

  /**
   * Processes the response that's returned by the permission service.
   */
  private onPermissionResponse (socketWrapper: SocketWrapper, message: Message, passItOn: any, error: ALL_ACTIONS | Error | string | null, result: boolean): void {
    if (error !== null) {
      this.services.logger.warn(EVENT_ACTIONS[EVENT_ACTIONS.MESSAGE_PERMISSION_ERROR], error.toString())
      const permissionErrorMessage: Message = {
        topic: message.topic,
        action: EVENT_ACTIONS.MESSAGE_PERMISSION_ERROR,
        originalAction: message.action,
        name: message.name
      }
      if (message.correlationId) {
        permissionErrorMessage.correlationId = message.correlationId
      }
      socketWrapper.sendMessage(permissionErrorMessage)
      return
    }

    if (result !== true) {
      const permissionDeniedMessage: Message = {
        topic: message.topic,
        action: EVENT_ACTIONS.MESSAGE_DENIED,
        originalAction: message.action,
        name: message.name
      }
      if (message.correlationId) {
        permissionDeniedMessage.correlationId = message.correlationId
      }
      socketWrapper.sendMessage(permissionDeniedMessage)
      return
    }

    this.onAuthenticatedMessage(socketWrapper, message)
  }

}
