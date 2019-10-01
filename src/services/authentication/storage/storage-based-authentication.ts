import * as crypto from 'crypto'
import { DeepstreamPlugin, DeepstreamAuthentication, UserAuthenticationCallback, DeepstreamServices, EVENT } from '../../../../ds-types/src/index'
import * as uuid from 'uuid'

const STRING = 'string'
const STRING_CHARSET = 'base64'

interface StorageAuthConfig {
  // the table to store and lookup the users in
  table: string,
  // upsert the user if it doesn't exist in db
  createUser: boolean,
  // the name of a HMAC digest algorithm, a.g. 'sha512'
  hash: string
  // the amount of times the algorithm should be applied
  iterations: number
  // the length of the resulting key
  keyLength: number
}

export class StorageBasedAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string = `Storage using table: ${this.settings.table}`
  private base64KeyLength: number

  private logger = this.services.logger.getNameSpace('STORAGE_AUTH')

  /**
  * Creates the class, reads and validates the users.json file
  */
  constructor (private settings: StorageAuthConfig, private services: DeepstreamServices) {
    super()
    this.base64KeyLength = 4 * Math.ceil(this.settings.keyLength / 3)
  }

  public async whenReady (): Promise<void> {
    await this.services.storage.whenReady()
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

    const storageId = `${this.settings.table}/${authData.username}`
    this.services.storage.get(storageId, async (err, version, userData) => {
      if (err) {
        this.logger.error(EVENT.ERROR, `Error retrieving user from storage ${JSON.stringify(err)}`)
        callback(false, { clientData: { error: 'Error retrieving user from storage' }})
        return
      }

      if (userData === null) {
        if (this.settings.createUser) {
          this.logger.info(EVENT.REGISTERING_USER, `Adding new user ${authData.username}`)
          const salt = crypto.randomBytes(16).toString(STRING_CHARSET)
          const hash = await this.createHash(authData.password, salt)
          const clientData = {
            id: uuid()
          }
          const serverData = {
            created: Date.now()
          }
          this.services.storage.set(storageId, 1, {
            username: authData.username,
            password: hash + salt,
            clientData,
            serverData
          }, () => {
            callback(true, {
              username: clientData.id,
              clientData,
              serverData
            })
          })
        } else {
          callback(false)
        }
        return
      }

      const expectedHash = userData.password.substr(0, this.base64KeyLength)
      const actualHash = await this.createHash(authData.password, userData.password.substr(this.base64KeyLength))

      if (expectedHash === actualHash) {
        callback(true, {
          username: userData.clientData.id,
          serverData: userData.serverData || null,
          clientData: userData.clientData || null,
        })
      } else {
        callback(false)
      }
    })
  }

  /**
  * Utility method for creating hashes including salts based on
  * the provided parameters
  */
 public createHash (password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      this.settings.iterations,
      this.settings.keyLength,
      this.settings.hash,
      (err, hash) => {
        err ? reject(err) : resolve(hash.toString(STRING_CHARSET))
      }
    )
  })
}
}
