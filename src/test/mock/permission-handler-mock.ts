import { PermissionCallback, SocketWrapper, DeepstreamPlugin } from '@deepstream/types'
import { Message } from '../../constants'

export default class PermissionHandlerMock extends DeepstreamPlugin {
  public nextCanPerformActionResult: any
  public lastCanPerformActionQueryArgs: any
  public description = 'PermissionHandlerMock'

  constructor () {
    super()
    this.reset()
  }

  public reset () {
    this.nextCanPerformActionResult = true
    this.lastCanPerformActionQueryArgs = null
  }

  public canPerformAction (socketWrapper: SocketWrapper, message: Message, callback: PermissionCallback, passItOn: any) {
    this.lastCanPerformActionQueryArgs = arguments
    if (typeof this.nextCanPerformActionResult === 'string') {
      callback(socketWrapper, message, passItOn, this.nextCanPerformActionResult, false)
    } else {
      callback(socketWrapper, message, passItOn, null, this.nextCanPerformActionResult)
    }
  }
}
