import { EventEmitter } from 'events'

export default class AuthenticationHandlerMock extends EventEmitter implements AuthenticationHandler {
  public onClientDisconnectCalledWith: any
  public sendNextValidAuthWithData: boolean
  public lastUserValidationQueryArgs: any
  public nextUserValidationResult: boolean
  public nextUserIsAnonymous: boolean
  public options: any
  public isReady: boolean
  public description: string

  constructor (options?) {
    super()
    this.options = options
    this.isReady = true
    this.description = 'Authentication Mock'
    this.reset()
  }

  public reset () {
    this.nextUserIsAnonymous = false
    this.nextUserValidationResult = true
    this.lastUserValidationQueryArgs = null
    this.sendNextValidAuthWithData = false
    this.onClientDisconnectCalledWith = null
  }

  public isValidUser (handshakeData, authData, callback) {
    this.lastUserValidationQueryArgs = arguments
    if (this.nextUserValidationResult === true) {
      if (this.sendNextValidAuthWithData === true) {
        callback(true, {
          username: 'test-user',
          clientData: 'test-data'
        })
      } else if (this.nextUserIsAnonymous) {
        callback(true, {})
      } else {
        callback(true, { username: 'test-user' })
      }
    } else {
      callback(false, { clientData: 'Invalid User' })
    }
  }

  public onClientDisconnect (username) {
    this.onClientDisconnectCalledWith = username
  }
}
