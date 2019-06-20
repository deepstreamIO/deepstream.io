import { EventEmitter } from 'events'
import { PermissionHandler, SocketWrapper, PermissionCallback } from '../types'
import { Message } from '../constants'

/**
 * The open permission handler allows any action to occur without applying
 * any permissions.
 */
export default class OpenPermissionHandler extends EventEmitter implements PermissionHandler {
  public description: string
  public isReady: true

  constructor () {
    super()
    this.description = 'none'
    this.isReady = true
  }

  /**
  * Allows any action by an user
  */
  public canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: object, socketWrapper: SocketWrapper) {
    callback(socketWrapper, message, null, true)
  }
}
