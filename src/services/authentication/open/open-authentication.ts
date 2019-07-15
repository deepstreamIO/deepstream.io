import { DeepstreamPlugin, DeepstreamAuthentication } from '../../../../ds-types/src/index'
import { JSONObject } from '../../../constants'

/**
 * Used for users that don't provide a username
 */
const OPEN: string = 'open'

/**
 * The open authentication handler allows every client to connect.
 * If the client specifies a username as part of its authentication
 * data, it will be used to identify the user internally
 */
export class OpenAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string  = 'Open Authentication'

  /**
  * Grants access to any user. Registeres them with username or open
  */
  public isValidUser (connectionData: JSONObject, authData: JSONObject, callback: Function) {
    callback(true, { username: authData.username || OPEN })
  }
}
