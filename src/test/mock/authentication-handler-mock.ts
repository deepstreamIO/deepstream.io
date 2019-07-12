import { DeepstreamPlugin, Authentication, UserAuthenticationCallback } from '../../types'
import { JSONObject } from '../../constants'

export default class AuthenticationMock extends DeepstreamPlugin implements Authentication {
  public onClientDisconnectCalledWith: string | null = null
  public sendNextValidAuthWithData: boolean = false
  public lastUserValidationQueryArgs: IArguments | null = null
  public nextUserValidationResult: boolean = true
  public nextUserIsAnonymous: boolean = false
  public description: string = 'Authentication Mock'

  constructor () {
    super()
    this.reset()
  }

  public reset () {
    this.nextUserIsAnonymous = false
    this.nextUserValidationResult = true
    this.lastUserValidationQueryArgs = null
    this.sendNextValidAuthWithData = false
    this.onClientDisconnectCalledWith = null
  }

  public isValidUser (handshakeData: JSONObject, authData: JSONObject, callback: UserAuthenticationCallback) {
    this.lastUserValidationQueryArgs = arguments
    if (this.nextUserValidationResult === true) {
      if (this.sendNextValidAuthWithData === true) {
        callback(true, {
          username: 'test-user',
          clientData: { value: 'test-data' }
        })
      } else if (this.nextUserIsAnonymous) {
        callback(true, {})
      } else {
        callback(true, { username: 'test-user' })
      }
    } else {
      callback(false, { clientData: { error: 'Invalid User' } })
    }
  }

  public onClientDisconnect (username: string) {
    this.onClientDisconnectCalledWith = username
  }
}
