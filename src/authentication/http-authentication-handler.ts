import { post } from 'needle'
import { EventEmitter } from 'events'
import * as utils from '../utils/utils'
import { EVENT } from '../constants';
import { AuthenticationHandler, Logger } from '../types'

interface HttpAuthenticationHandlerSettings {
  // http(s) endpoint that will receive post requests
  endpointUrl: string
  // an array of http status codes that qualify as permitted
  permittedStatusCodes: number[]
  // time in milliseconds before the request times out if no reply is received
  requestTimeout: number
  // fields to copy from authData to header, useful for when endpoints authenticate using middleware
  promoteToHeader: string[]
}

export default class HttpAuthenticationHandler extends EventEmitter implements AuthenticationHandler {
  public isReady: boolean
  public description: string

  constructor (private settings: HttpAuthenticationHandlerSettings, private logger: Logger) {
    super()
    this.isReady = true
    this.description = `http webhook to ${settings.endpointUrl}`
    this.validateSettings()
    if (this.settings.promoteToHeader === undefined) {
      this.settings.promoteToHeader = []
    }
  }

  public isValidUser (connectionData, authData, callback): void {
      const options = {
        read_timeout: this.settings.requestTimeout,
        open_timeout: this.settings.requestTimeout,
        timeout: this.settings.requestTimeout,
        follow_max: 2,
        json: true,
        headers: {}
      }

      if (this.settings.promoteToHeader.length > 0) {
        options.headers = this.settings.promoteToHeader.reduce(
          (result, property) => {
            if (authData[property]) {
              result[property] = authData[property]
            }
            return result
          },
          {}
        )
      }

      post(this.settings.endpointUrl, { connectionData, authData }, options, (error, response) => {
        if (error) {
          this.logger.warn(EVENT.AUTH_ERROR, `http auth error: ${error}`)
          callback(false, null)
          return
        }

        if (!response.statusCode) {
          this.logger.warn(EVENT.AUTH_ERROR, 'http auth server error: missing status code!')
          callback(false, null)
          return
        }

        if (response.statusCode >= 500 && response.statusCode < 600) {
          this.logger.warn(EVENT.AUTH_ERROR, `http auth server error: ${JSON.stringify(response.body)}`)
        }

        if (this.settings.permittedStatusCodes.indexOf(response.statusCode) === -1) {
          callback(false, response.body || null)
          return
        }

        if (response.body && typeof response.body === 'string') {
          callback(true, { username: response.body })
          return
        }

        callback(true, response.body || null)
      })
  }

  private validateSettings (): void {
    utils.validateMap(this.settings, true, {
      endpointUrl: 'url',
      permittedStatusCodes: 'array',
      requestTimeout: 'number',
    })
  }
}
