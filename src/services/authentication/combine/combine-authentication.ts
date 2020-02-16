import { DeepstreamPlugin, DeepstreamAuthenticationCombiner, DeepstreamAuthentication, UserAuthenticationCallback } from '@deepstream/types'
import { JSONObject } from '../../../constants'

/**
 * The open authentication handler allows every client to connect.
 * If the client specifies a username as part of its authentication
 * data, it will be used to identify the user internally
 */
export class CombineAuthentication extends DeepstreamPlugin implements DeepstreamAuthenticationCombiner {
  public description: string = ''

  constructor (private auths: DeepstreamAuthentication[]) {
    super()
    if (auths.length === 1) {
      this.description = auths[0].description
    } else {
      this.description = auths.map((auth, index) => `\n\t${index}) ${auth.description}`).join('')
    }
  }

  public async whenReady () {
    await Promise.all(this.auths.map((auth) => auth.whenReady()))
  }

  public async close () {
    await Promise.all(this.auths.map((auth) => auth.close()))
  }

  public async isValidUser (connectionData: JSONObject, authData: JSONObject, callback: UserAuthenticationCallback) {
    for (const auth of this.auths) {
      const result = await auth.isValidUser(connectionData, authData)
      if (result) {
        callback(result.isValid, result)
        return
      }
    }
    callback(false)
  }

  public onClientDisconnect (userId: string): void {
    for (const auth of this.auths) {
      if (auth.onClientDisconnect) {
        auth.onClientDisconnect(userId)
      }
    }
  }
}
