import { PermissionHandler, SocketWrapper, PermissionCallback, DeepstreamPlugin } from '../types'
import { Message } from '../constants'
import { JSONObject } from '@deepstream/client/dist/binary-protocol/src/message-constants'

/**
 * The open permission handler allows any action to occur without applying
 * any permissions.
 */
export default class OpenPermissionHandler extends DeepstreamPlugin implements PermissionHandler {
  public description: string = 'none'
  public isReady: true = true

  /**
  * Allows any action by an user
  */
  public canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: JSONObject, socketWrapper: SocketWrapper, passItOn: any) {
    callback(socketWrapper, message, passItOn, null, true)
  }
}
