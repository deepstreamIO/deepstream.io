import { TOPIC, CONNECTION_ACTION, Message, ALL_ACTIONS, ACTIONS, RECORD_ACTION  } from '../constants'
import { SocketWrapper, DeepstreamConfig, DeepstreamServices, EVENT } from '@deepstream/types'
import { getUid } from './utils'

/**
 * The MessageProcessor consumes blocks of parsed messages emitted by the
 * ConnectionEndpoint, checks if they are permissioned and - if they
 * are - forwards them.
 */
export default class MessageProcessor {
  private bulkResults = new Map<string, { total: number, completed: number }>()

  constructor (config: DeepstreamConfig, private services: DeepstreamServices) {
    this.onPermissionResponse = this.onPermissionResponse.bind(this)
    this.onBulkPermissionResponse = this.onBulkPermissionResponse.bind(this)
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
    const length = parsedMessages.length
    for (let i = 0; i < length; i++) {
      const message = parsedMessages[i]

      if (message.topic === TOPIC.CONNECTION && message.action === CONNECTION_ACTION.PING) {
        // respond to PING message
        socketWrapper.sendMessage({ topic: TOPIC.CONNECTION, action: CONNECTION_ACTION.PONG })
        continue
      }

      if (message.names && message.names.length > 0) {
        const uuid = getUid()

        if (this.bulkResults.has(uuid)) {
          this.services.logger.error(EVENT.NOT_VALID_UUID, `Invalid uuid used twice ${uuid}`, { uuid })
        }

        this.bulkResults.set(uuid, {
          total: message.names!.length,
          completed: 0
        })
        const l = message.names!.length
        for (let j = 0; j < l; j++) {
          this.services.permission.canPerformAction(
            socketWrapper,
            { ...message, name: message.names![j] },
            this.onBulkPermissionResponse,
            { originalMessage: message, uuid }
          )
        }
        continue
      }

      this.services.permission.canPerformAction(
        socketWrapper,
        message,
        this.onPermissionResponse,
        {}
      )
    }
  }

  private onBulkPermissionResponse (socketWrapper: SocketWrapper, message: Message, passItOn: any, error: ALL_ACTIONS | Error | string | null, result: boolean) {
    const bulkResult = this.bulkResults.get(passItOn.uuid)!

    if (error !== null || result === false) {
      passItOn.originalMessage.names!.splice(passItOn.originalMessage.names!.indexOf(passItOn.originalMessage.name!), 1)
      this.processInvalidResponse(socketWrapper, message, error, result)
    }

    if (bulkResult.total !== bulkResult.completed + 1) {
      bulkResult.completed = bulkResult.completed + 1
      return
    }

    this.bulkResults.delete(passItOn.uuid)

    if (message.names!.length > 0) {
      this.onAuthenticatedMessage(socketWrapper, passItOn.originalMessage)
    }
  }

  /**
   * Processes the response that's returned by the permission service.
   */
  private onPermissionResponse (socketWrapper: SocketWrapper, message: Message, passItOn: any, error: ALL_ACTIONS | Error | string | null, result: boolean): void {
    if (error !== null || result === false) {
      this.processInvalidResponse(socketWrapper, message, error, result)
    } else {
      this.onAuthenticatedMessage(socketWrapper, message)
    }
  }

  private processInvalidResponse (socketWrapper: SocketWrapper, message: Message, error: ALL_ACTIONS | Error | string | null, result: boolean) {
    if (error !== null) {
      this.services.logger.warn(RECORD_ACTION[RECORD_ACTION.MESSAGE_PERMISSION_ERROR], error.toString(), { message })
      const permissionErrorMessage: Message = {
        topic: message.topic,
        action: ACTIONS[message.topic].MESSAGE_PERMISSION_ERROR,
        originalAction: message.action,
        name: message.name,
        isError: true
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
        action: ACTIONS[message.topic].MESSAGE_DENIED,
        originalAction: message.action,
        name: message.name,
        isError: true
      }
      if (message.correlationId) {
        permissionDeniedMessage.correlationId = message.correlationId
      }
      socketWrapper.sendMessage(permissionDeniedMessage)
      return
    }
  }
}
