import { EventEmitter } from 'events'

/**
 * Used for users that don't provide a username
 */
const OPEN: string = 'open'

/**
 * The open authentication handler allows every client to connect.
 * If the client specifies a username as part of its authentication
 * data, it will be used to identify the user internally
 */
export default class OpenAuthenticationHandler extends EventEmitter implements AuthenticationHandler {
  public isReady: boolean
  public description: string

  constructor () {
    super()
    this.description = 'none'
    this.isReady = true
  }

  /**
  * Grants access to any user. Registeres them with username or open
  */
  public isValidUser (connectionData: any, authData: any, callback: Function) {
    callback(true, { username: authData.username || OPEN })
  }
}
