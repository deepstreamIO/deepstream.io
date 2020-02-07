import { DeepstreamPlugin, DeepstreamAuthentication, DeepstreamServices, EVENT, DeepstreamAuthenticationResult } from '@deepstream/types'
import * as uuid from 'uuid'
import { Dictionary } from 'ts-essentials'
import { createHash } from '../../../utils/utils'

const STRING = 'string'

interface StorageAuthConfig {
  reportInvalidParameters: boolean,
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

type UserData = DeepstreamAuthenticationResult & {
  password: string,
  clientData: { [index: string]: any, id: string },
  serverData: Dictionary<string>
}

export class StorageBasedAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string = `Storage using table: ${this.settings.table}`
  private base64KeyLength: number

  private logger = this.services.logger.getNameSpace('STORAGE_AUTH')
  private hashSettings = {
      iterations: this.settings.iterations,
      keyLength: this.settings.keyLength,
      algorithm: this.settings.hash
  }

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
  public async isValidUser (connectionData: any, authData: any): Promise<DeepstreamAuthenticationResult | null> {
    const missingUsername = typeof authData.username !== STRING
    const missingPassword = typeof authData.password !== STRING

    if (missingPassword || missingUsername) {
      if (this.settings.reportInvalidParameters) {
        return {
          isValid: false,
          clientData: { error: `missing authentication parameters: ${missingUsername && 'username'} ${missingPassword && 'password'}` }
        }
      } else {
        return null
      }
    }

    let userData: UserData
    try {
      userData = await new Promise((resolve, reject) => this.services.storage.get(storageId, (err, version, data) => err ? reject(err) : resolve(data)))
    } catch (err) {
      this.logger.error(EVENT.ERROR, `Error retrieving user from storage ${JSON.stringify(err)}`)
      return {
        isValid: false,
        clientData: { error: 'Error retrieving user from storage' }
      }
    }
    const storageId = `${this.settings.table}/${authData.username}`

    if (userData === null) {
      if (this.settings.createUser) {
        this.logger.info(EVENT.REGISTERING_USER, `Adding new user ${authData.username}`)
        const { hash, salt } = await createHash(authData.password, this.hashSettings)
        const clientData = {
          id: uuid(),
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
          return {
            isValid: true,
            id: clientData.id,
            clientData,
            serverData
          }
        })
      }
      return null
    }

    const expectedHash = userData.password.substr(0, this.base64KeyLength)
    const { hash: actualHash } = await createHash(authData.password, this.hashSettings, userData.password.substr(this.base64KeyLength))

    if (expectedHash === actualHash.toString('base64')) {
      return {
        isValid: true,
        id: userData.clientData.id,
        serverData: userData.serverData || null,
        clientData: userData.clientData || null,
      }
    }

    return { isValid: false }
  }
}
