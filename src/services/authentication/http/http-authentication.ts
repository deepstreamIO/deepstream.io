import { post } from 'needle'
import { EVENT, DeepstreamPlugin, DeepstreamServices, DeepstreamConfig, DeepstreamAuthentication, DeepstreamAuthenticationResult } from '@deepstream/types'
import { JSONObject } from '../../../constants'
import { validateMap } from '../../../utils/utils'

interface HttpAuthenticationHandlerSettings {
  // http(s) endpoint that will receive post requests
  endpointUrl: string
  // an array of http status codes that qualify as permitted
  permittedStatusCodes: number[]
  // time in milliseconds before the request times out if no reply is received
  requestTimeout: number
  // fields to copy from authData to header, useful for when endpoints authenticate using middleware
  promoteToHeader: string[],
  // any array of status codes that should be retries, useful if the server is down during a deploy
  // or generally unresponsive
  retryStatusCodes: number[],
  // the maximum amount of retries before returning a false login
  retryAttempts: number,
  // the time in milliseconds between retries
  retryInterval: number,
  // fail authentication process if invalid login parameters are used
  reportInvalidParameters: boolean
}

export class HttpAuthentication extends DeepstreamPlugin implements DeepstreamAuthentication {
  public description: string = `http webhook to ${this.settings.endpointUrl}`
  private retryAttempts = new Map<number, { connectionData: any, authData: any, callback: (result: DeepstreamAuthenticationResult | null) => void, attempts: number } >()
  private requestId = 0

  constructor (private settings: HttpAuthenticationHandlerSettings, private services: DeepstreamServices, config: DeepstreamConfig) {
    super()
    this.validateSettings()
    if (this.settings.promoteToHeader === undefined) {
      this.settings.promoteToHeader = []
    }
    if (this.settings.reportInvalidParameters === undefined) {
      this.settings.reportInvalidParameters = true
    }
  }

  public async isValidUser (connectionData: JSONObject, authData: JSONObject) {
    return new Promise((resolve: (result: DeepstreamAuthenticationResult | null) => void) => {
      this.validate(this.requestId++, connectionData, authData, resolve)
    })
  }

  private validate (id: number, connectionData: JSONObject, authData: JSONObject, callback: (result: DeepstreamAuthenticationResult | null) => void): void {
    const options = {
      read_timeout: this.settings.requestTimeout,
      open_timeout: this.settings.requestTimeout,
      response_timeout: this.settings.requestTimeout,
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
        {} as JSONObject
      )
    }

    post(this.settings.endpointUrl, { connectionData, authData }, options, (error, response) => {
      if (error) {
        this.services.logger.warn(EVENT.AUTH_ERROR, `http auth error: ${error}`)
        this.retry(id, connectionData, authData, callback)
        return
      }

      if (!response.statusCode) {
        this.services.logger.warn(EVENT.AUTH_ERROR, 'http auth server error: missing status code!')
        this.retryAttempts.delete(id)
        if (this.settings.reportInvalidParameters) {
          callback({ isValid: false })
        } else {
          callback(null)
        }

        return
      }

      if (response.statusCode >= 500 && response.statusCode < 600) {
        this.services.logger.warn(EVENT.AUTH_ERROR, `http auth server error: ${JSON.stringify(response.body)}`)
      }

      if (this.settings.retryStatusCodes.includes(response.statusCode)) {
        this.retry(id, connectionData, authData, callback)
        return
      }

      this.retryAttempts.delete(id)

      if (this.settings.permittedStatusCodes.indexOf(response.statusCode) === -1) {
        if (this.settings.reportInvalidParameters) {
          if (typeof response.body === 'string' && response.body) {
            callback({ isValid: false, clientData: { error: response.body }})
          } else {
            callback({ isValid: false, ...response.body })
          }
        } else {
          callback(null)
        }
        return
      }

      if (response.body && typeof response.body === 'string') {
        callback({ isValid: true, id: response.body })
        return
      }

      callback({ isValid: true, ...response.body })
    })
  }

  private retry (id: number, connectionData: JSONObject, authData: JSONObject, callback: (result: DeepstreamAuthenticationResult | null) => void) {
    let retryAttempt = this.retryAttempts.get(id)
    if (!retryAttempt) {
      retryAttempt = {
        connectionData,
        authData,
        callback,
        attempts: 0
      }
      this.retryAttempts.set(id, retryAttempt)
    } else {
      retryAttempt.attempts++
    }
    if (retryAttempt.attempts < this.settings.retryAttempts) {
      setTimeout(() => this.validate(id, connectionData, authData, callback), this.settings.retryInterval)
    } else {
      this.retryAttempts.delete(id)
      if (this.settings.reportInvalidParameters) {
        callback({
          isValid: false,
          clientData: {
            error: EVENT.AUTH_RETRY_ATTEMPTS_EXCEEDED
          }
        })
      } else {
        this.services.logger.warn(EVENT.AUTH_ERROR, EVENT.AUTH_RETRY_ATTEMPTS_EXCEEDED)
        callback(null)
      }
    }
  }

  private validateSettings (): void {
    validateMap(this.settings, true, {
      endpointUrl: 'url',
      permittedStatusCodes: 'array',
      requestTimeout: 'number',
      retryStatusCodes: 'array',
      retryAttempts: 'number',
      retryInterval: 'number'
    })
  }
}
