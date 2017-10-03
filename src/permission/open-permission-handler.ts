import { EventEmitter } from 'events'

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
  canPerformAction (username: string, message: Message, callback: Function, authData: object, socketWrapper: SocketWrapper) {
    callback(null, true)
  }
}
