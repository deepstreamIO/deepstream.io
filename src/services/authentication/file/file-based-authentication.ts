import * as crypto from 'crypto'
import { DeepstreamPlugin, DeepstreamAuthentication, DeepstreamServices, EVENT } from '../../../../ds-types/src/index'
import { validateMap } from '../../../utils/utils'
import { readAndParseFile } from '../../../config/js-yaml-loader'
import { EventEmitter } from 'events'

const STRING = 'string'
const STRING_CHARSET = 'base64'

interface FileAuthConfig {
  //  path to the user file
  path: string
  // the name of a HMAC digest algorithm, a.g. 'sha512'
  hash: string | false
  // the amount of times the algorithm should be applied
  iterations: number
  // the length of the resulting key
  keyLength: number,
  // if this is the only authentication mechanism, fail if invalid login parameters are used
  reportInvalidParameters: boolean
}

/**
 * This authentication handler reads a list of users and their associated password (either
 * hashed or in cleartext ) from a json file. This can be useful to authenticate smaller amounts
 * of clients with static credentials, e.g. backend provider that write to publicly readable records
 */
export class FileBasedAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string = `file using ${this.settings.path}`
  private base64KeyLength: number
  private data: any

  private isReady: boolean = false
  private emitter = new EventEmitter()

  /**
  * Creates the class, reads and validates the users.json file
  */
  constructor (private settings: FileAuthConfig, private services: DeepstreamServices) {
    super()
    this.validateSettings(settings)
    this.base64KeyLength = 4 * Math.ceil(this.settings.keyLength / 3)
    readAndParseFile(settings.path, this.onFileLoad.bind(this))
  }

  public async whenReady (): Promise<void> {
    if (!this.isReady) {
      return new Promise((resolve) => this.emitter.once('ready', resolve))
    }
  }
  /**
  * Main interface. Authenticates incoming connections
  */
  public async isValidUser (connectionData: any, authData: any) {
    const missingUsername = typeof authData.username !== STRING
    const missingPassword = typeof authData.password !== STRING

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

    const userData = this.data[authData.username]

    if (!userData) {
      return null
    }

    const actualPassword = this.settings.hash ? userData.password.substr(0, this.base64KeyLength) : userData.password
    let expectedPassword = authData.password

    if (typeof this.settings.hash === 'string') {
      const salt = userData.password.substr(this.base64KeyLength)

      expectedPassword = await new Promise((resolve, reject) => crypto.pbkdf2(
        authData.password,
        salt,
        this.settings.iterations,
        this.settings.keyLength,
        this.settings.hash as string,
        (err, hash) => err ? reject(err) : resolve(hash)
      ))

      expectedPassword = expectedPassword.toString(STRING_CHARSET)
    }

    if (actualPassword === expectedPassword) {
      return {
        isValid: true,
        id: authData.username,
        serverData: typeof userData.serverData === 'undefined' ? null : userData.serverData,
        clientData: typeof userData.clientData === 'undefined' ? null : userData.clientData,
      }
    }

    return { isValid: false }
  }

  /**
  * Utility method for creating hashes including salts based on
  * the provided parameters
  */
  public createHash (password: string, callback: Function): void {
    const salt = crypto.randomBytes(16).toString(STRING_CHARSET)

    crypto.pbkdf2(
        password,
        salt,
        this.settings.iterations,
        this.settings.keyLength,
        this.settings.hash as string,
        (err, hash) => {
          callback(err || null, hash.toString(STRING_CHARSET) + salt)
        },
    )
  }

  /**
  * Callback for loaded JSON files. Makes sure that
  * no errors occured and every user has an associated password
  */
  private onFileLoad (error: Error | null, data: any): void {
    if (error) {
      this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, `Error loading file ${this.settings.path}`)
      return
    }

    this.data = data

    if (Object.keys(data).length === 0) {
      this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'no users present in user file')
      return
    }

    for (const username in this.data) {
      if (typeof this.data[username].password !== STRING) {
        this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, `missing password for ${username}`)
      }
    }

    this.isReady = true
    this.emitter.emit('ready')
  }

  /**
  * Called initially to validate the user provided settings
  */
  private validateSettings (settings: any) {
    try {
      if (!settings.hash) {
        validateMap(settings, true, {
          path: 'string',
        })
        return
      }

      validateMap(settings, true, {
        path: 'string',
        hash: 'string',
        iterations: 'number',
        keyLength: 'number',
      })

      if (crypto.getHashes().indexOf(settings.hash) === -1) {
        throw new Error(`Unknown Hash ${settings.hash}`)
      }
    } catch (e) {
      this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'Validating settings failed for file auth', e.message)
    }

  }
}
