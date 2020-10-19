import { DeepstreamPlugin, DeepstreamAuthentication, DeepstreamServices, EVENT } from '@deepstream/types'
import { validateMap, createHash, validateHashingAlgorithm } from '../../../utils/utils'

interface FileAuthConfig {
  users: any
  // the name of a HMAC digest algorithm, a.g. 'sha512'
  hash: string | false
  // the amount of times the algorithm should be applied
  iterations: number
  // the length of the resulting key
  keyLength: number,
  // fail authentication process if invalid login parameters are used
  reportInvalidParameters: boolean
}

/**
 * This authentication handler reads a list of users and their associated password (either
 * hashed or in cleartext ) from a json file. This can be useful to authenticate smaller amounts
 * of clients with static credentials, e.g. backend provider that write to publicly readable records
 */
export class FileBasedAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string = 'File Authentication'
  private base64KeyLength: number
  private hashSettings = {
    iterations: this.settings.iterations,
    keyLength: this.settings.keyLength,
    algorithm: this.settings.hash
  }

  /**
  * Creates the class, reads and validates the users.json file
  */
  constructor (private settings: FileAuthConfig, private services: DeepstreamServices) {
    super()
    this.validateSettings(settings)
    this.base64KeyLength = 4 * Math.ceil(this.settings.keyLength / 3)
    if (this.settings.reportInvalidParameters === undefined) {
      this.settings.reportInvalidParameters = true
    }
  }

  public async whenReady (): Promise<void> {
  }

  /**
  * Main interface. Authenticates incoming connections
  */
  public async isValidUser (connectionData: any, authData: any) {
    const missingUsername = typeof authData.username !== 'string'
    const missingPassword = typeof authData.password !== 'string'

    if (missingPassword || missingUsername) {
      if (this.settings.reportInvalidParameters) {
        return {
          isValid: false,
          clientData: { error: 'missing authentication parameter: username or/and password' }
        }
      } else {
        return null
      }
    }

    const userData = this.settings.users[authData.username]

    if (!userData) {
      return null
    }

    const actualPassword = this.settings.hash ? userData.password.substr(0, this.base64KeyLength) : userData.password
    let expectedPassword = authData.password

    if (typeof this.settings.hash === 'string') {
      ({ hash: expectedPassword} = await createHash(authData.password, this.hashSettings as any, userData.password.substr(this.base64KeyLength)))
      expectedPassword = expectedPassword.toString('base64')
    }

    if (actualPassword === expectedPassword) {
      return {
        isValid: true,
        id: authData.username,
        serverData: typeof userData.serverData === 'undefined' ? null : userData.serverData,
        clientData: typeof userData.clientData === 'undefined' ? null : userData.clientData,
      }
    }
    if (this.settings.reportInvalidParameters) {
      return { isValid: false }
    }
    return null
  }

  /**
  * Called initially to validate the user provided settings
  */
  private validateSettings (settings: FileAuthConfig) {
    try {
      if (settings.hash) {
        validateMap(settings, true, {
          hash: 'string',
          iterations: 'number',
          keyLength: 'number',
        })
        validateHashingAlgorithm(settings.hash)
      }
    } catch (e) {
      this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'Validating settings failed for file auth', e.message)
    }

    if (Object.keys(settings.users).length === 0) {
      this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'no users present in user file')
      return
    }

    for (const username in this.settings.users) {
      if (typeof settings.users[username].password !== 'string') {
        this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, `missing password for ${username}`)
      }
    }
  }
}
