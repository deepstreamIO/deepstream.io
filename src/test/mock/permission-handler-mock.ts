import { PermissionCallback } from "../../types";

export default class PermissionHandlerMock {
  public isReady: boolean
  public options: any
  public nextCanPerformActionResult: any
  public lastCanPerformActionQueryArgs: any

  constructor (options?) {
    this.isReady = true
    this.options = options
    this.reset()
  }

  public reset () {
    this.nextCanPerformActionResult = true
    this.lastCanPerformActionQueryArgs = null
  }

  public canPerformAction (username, message, callback: PermissionCallback, authData, socketWrapper, passItOn) {
    this.lastCanPerformActionQueryArgs = arguments
    if (typeof this.nextCanPerformActionResult === 'string') {
      callback(socketWrapper, message, passItOn, this.nextCanPerformActionResult, false)
    } else {
      callback(socketWrapper, message, passItOn, null, this.nextCanPerformActionResult)
    }
  }
}
