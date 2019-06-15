import { EventEmitter } from 'events'
import { AuthenticationCallback } from '@deepstream/client/dist/src/connection/connection';
import { JSONObject } from '../../../binary-protocol/src/message-constants';

export default class AuthenticationHandlerMock extends EventEmitter {
  public onClientDisconnectCalledWith: string | null = null
  public sendNextValidAuthWithData: boolean = false
  public lastUserValidationQueryArgs: IArguments | null = null
  public nextUserValidationResult: boolean = true
  public nextUserIsAnonymous: boolean = false
  public isReady: boolean = true
  public description: string = 'Authentication Mock'

  constructor () {
    super()
    this.isReady = true
    this.reset()
  }

  public reset () {
    this.nextUserIsAnonymous = false
    this.nextUserValidationResult = true
    this.lastUserValidationQueryArgs = null
    this.sendNextValidAuthWithData = false
    this.onClientDisconnectCalledWith = null
  }

  public isValidUser (handshakeData: JSONObject, authData: JSONObject, callback: AuthenticationCallback) {
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

  public onClientDisconnect (username: string) {
    this.onClientDisconnectCalledWith = username
  }
}
