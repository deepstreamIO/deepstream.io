import { Message } from '../../../constants'
import { DeepstreamPlugin, DeepstreamPermission, PermissionCallback, SocketWrapper } from '@deepstream/types'

/**
 * The open permission handler allows any action to occur without applying
 * any permissions.
 */
export class OpenPermission extends DeepstreamPlugin implements DeepstreamPermission {
  public description: string = 'none'

  /**
  * Allows any action by an user
  */
  public canPerformAction (socketWrapper: SocketWrapper, message: Message, callback: PermissionCallback, passItOn: any) {
    callback(socketWrapper, message, passItOn, null, true)
  }
}
