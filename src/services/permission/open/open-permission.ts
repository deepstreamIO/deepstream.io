import { Message, JSONObject } from '../../../constants'
import { DeepstreamPlugin, DeepstreamPermission, PermissionCallback, SocketWrapper } from '../../../../ds-types/src/index'

/**
 * The open permission handler allows any action to occur without applying
 * any permissions.
 */
export class OpenPermission extends DeepstreamPlugin implements DeepstreamPermission {
  public description: string = 'none'

  /**
  * Allows any action by an user
  */
  public canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: JSONObject, socketWrapper: SocketWrapper, passItOn: any) {
    callback(socketWrapper, message, passItOn, null, true)
  }
}
