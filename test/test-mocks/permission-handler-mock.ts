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

  public canPerformAction (username, message, callback) {
    this.lastCanPerformActionQueryArgs = arguments
    if (typeof this.nextCanPerformActionResult === 'string') {
      callback(this.nextCanPerformActionResult)
    } else {
      callback(null, this.nextCanPerformActionResult)
    }
  }
}
