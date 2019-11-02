import { DeepstreamPlugin, DeepstreamAuthentication } from '@deepstream/types'
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
  * Grants access to any user. Registers them with username or open
  */
  public async isValidUser (connectionData: JSONObject, authData: JSONObject) {
    return {
      isValid: true,
      id: (authData.username && authData.username.toString()) || OPEN
    }
  }
}
