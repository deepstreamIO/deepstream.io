import { DeepstreamPlugin, DeepstreamAuthentication, DeepstreamAuthenticationResult } from '../../../ds-types/src/index'

export default class AuthenticationMock extends DeepstreamPlugin implements DeepstreamAuthentication {
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

  public async isValidUser (handshakeData: any, authData: any): Promise<DeepstreamAuthenticationResult> {
    this.lastUserValidationQueryArgs = arguments
    if (this.nextUserValidationResult === true) {
      if (this.sendNextValidAuthWithData === true) {
        return {
          isValid: true,
          id: 'test-user',
          clientData: { value: 'test-data' }
        }
      }
      if (this.nextUserIsAnonymous) {
        return {
          isValid: true,
          id: 'open'
        }
      }
      return {
        isValid: true,
        id: 'test-user'
      }
    }

    return {
      isValid: false,
      clientData: { error: 'Invalid User' }
    }
  }

  public onClientDisconnect (username: string) {
    this.onClientDisconnectCalledWith = username
  }
}
