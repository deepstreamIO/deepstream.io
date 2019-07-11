import * as crypto from 'crypto'
import { DeepstreamPlugin, Authentication, UserAuthenticationCallback, DeepstreamServices } from '../../../types'
import { JSONObject, EVENT } from '../../../constants'
import { validateMap } from '../../../utils/utils'
import { readAndParseFile } from '../../../config/js-yaml-loader'
import { EventEmitter } from 'events';

const STRING = 'string'
const STRING_CHARSET = 'base64'

interface FileAuthConfig {
  //  path to the user file
  path: string
  // the name of a HMAC digest algorithm, a.g. 'sha512'
  hash: string
  // the amount of times the algorithm should be applied
  iterations: number
  // the length of the resulting key
  keyLength: number
}

/**
 * This authentication handler reads a list of users and their associated password (either
 * hashed or in cleartext ) from a json file. This can be useful to authenticate smaller amounts
 * of clients with static credentials, e.g. backend provider that write to publicly readable records
 */
export class FileBasedAuthentication extends DeepstreamPlugin implements Authentication {
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
  public isValidUser (connectionData: any, authData: any, callback: UserAuthenticationCallback): void {
    if (typeof authData.username !== STRING) {
      callback(false, { clientData: { error: 'missing authentication parameter username' }})
      return
    }

    if (typeof authData.password !== STRING) {
      callback(false, { clientData: { error: 'missing authentication parameter password' } })
      return
    }

    const userData = this.data[authData.username]

    if (!userData) {
      callback(false)
      return
    }

    if (this.settings.hash) {
      this.isValid(
        authData.password,
        userData.password,
        authData.username,
        userData.serverData,
        userData.clientData,
        callback,
      )
    } else if (authData.password === userData.password) {
      callback(true, {
        username: authData.username,
        serverData: typeof userData.serverData === 'undefined' ? null : userData.serverData,
        clientData: typeof userData.clientData === 'undefined' ? null : userData.clientData,
      })
    } else {
      callback(false)
    }
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
        this.settings.hash,
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
  }

  /**
  * Extracts hash and salt from a string and runs a hasing function
  * against it
  *
  * @param   {String}   password             the cleartext password the user provided
  * @param   {String}   passwordHashWithSalt the hash+salt combination from the users.json file
  * @param   {String}   username             as provided by user
  * @param   {Object}   serverData           arbitrary authentication data that will be passed on
  *                                          to the permission handler
  * @param   {Object}   clientData           arbitrary authentication data that will be passed on
  *                                          to the client
  * @param   {Function} callback             callback that will be invoked once hash is created
  *
  * @private
  * @returns {void}
  */
  private isValid (password: string, passwordHashWithSalt: string, username: string, serverData: object, clientData: object, callback: Function) {
    const expectedHash = passwordHashWithSalt.substr(0, this.base64KeyLength)
    const salt = passwordHashWithSalt.substr(this.base64KeyLength)

    crypto.pbkdf2(
      password,
      salt,
      this.settings.iterations,
      this.settings.keyLength,
      this.settings.hash,
      // @ts-ignore
      this.compareHashResult.bind(this, expectedHash, username, serverData, clientData, callback),
    )
  }

  /**
  * Callback once hashing is completed
  *
  * @param   {String}   expectedHash     has as retrieved from users.json
  * @param   {Object}   serverData       arbitrary authentication data that will be passed on to the
  *                                      permission handler
  * @param   {Object}   clientData       arbitrary authentication data that will be passed on to the
  *                                      client
  * @param   {Function} callback         callback from isValidUser
  * @param   {Error}    error            error that occured during hashing
  * @param   {Buffer}   actualHashBuffer the buffer containing the bytes for the new hash
  */
  private compareHashResult (
    expectedHash: string, username: string, serverData: JSONObject, clientData: JSONObject, callback: UserAuthenticationCallback, error: Error | null, actualHashBuffer: Buffer,
  ) {
    if (expectedHash === actualHashBuffer.toString(STRING_CHARSET)) {
      // todo log error
      callback(true, {
        username,
        serverData: serverData || null,
        clientData: clientData || null,
      })
    } else {
      callback(false)
    }
  }
}
