import { DeepstreamPlugin, DeepstreamAuthenticationCombiner, DeepstreamAuthentication, DeepstreamServices, DeepstreamConfig } from '../../../../ds-types/src/index'
import { JSONObject } from '../../../constants'

/**
 * The open authentication handler allows every client to connect.
 * If the client specifies a username as part of its authentication
 * data, it will be used to identify the user internally
 */
export class CombineAuthentication extends DeepstreamPlugin implements DeepstreamAuthenticationCombiner {
  public description: string = ''

  constructor (auths: DeepstreamAuthentication[], services: DeepstreamServices, config: DeepstreamConfig) {
    super()
  }

  public async isValidUser (connectionData: JSONObject, authData: JSONObject) {
      return { isValid: false }
  }
}
