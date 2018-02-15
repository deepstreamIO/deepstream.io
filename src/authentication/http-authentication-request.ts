import * as needle from 'needle'
import { EVENT } from '../constants'

/**
 * This class represents a single request from deepstream to a http
 * endpoint for authentication data
 */
export default class HttpAuthenticationRequest {
  private settings: any
  private callback: Function
  private logger: Logger

  /**
   * Creates and issues the request and starts the timeout
   *
   * @param   {Object}   data           Map with authData and connectionData
   * @param   {Object}   settings       contains requestTimeout and permittedStatusCodes
   * @param   {Function} callback       Called with error, isAuthenticated, userData
   * @param   {Logger}   logger
   *
   * @constructor
   * @returns {void}
   */
  constructor (data: any, settings: any, logger: Logger, callback: Function) {
    this.settings = settings
    this.callback = callback
    this.logger = logger

    const options = {
      read_timeout: settings.requestTimeout,
      open_timeout: settings.requestTimeout,
      timeout: settings.requestTimeout,
      follow_max: 2,
      json: true,
      pfx: settings.pfx,
      key: settings.key,
      passphrase: settings.passphrase,
      cert: settings.cert,
      ca: settings.ca,
      ciphers: settings.ciphers,
      rejectUnauthorized: settings.rejectUnauthorized || true,
      secureProtocol: settings.secureProtocol || 'TLSv1_2_method'
    }

    needle.post(settings.endpointUrl, data, options, this._onComplete.bind(this))
  }

  /**
   * Invoked for completed responses, whether succesful
   * or errors
   *
   * @param {Error} error HTTP Error
   * @param {http.Response} response
   */
  private _onComplete (error: Error, response: any): void {
    if (error) {
      this.logger.warn(EVENT.AUTH_ERROR, `http auth error: ${error}`)
      this.callback(false, null)
      this._destroy()
      return
    }

    if (response.statusCode >= 500 && response.statusCode < 600) {
      this.logger.warn(EVENT.AUTH_ERROR, `http auth server error: ${JSON.stringify(response.body)}`)
    }

    if (this.settings.permittedStatusCodes.indexOf(response.statusCode) === -1) {
      this.callback(false, response.body || null)
    } else if (response.body && typeof response.body === 'string') {
      this.callback(true, { username: response.body })
    } else {
      this.callback(true, response.body || null)
    }

    this._destroy()
  }

  /**
   * Destroys the class
   */
  private _destroy (): void {
    // this.callback = null
    // this.logger = null
    // this.settings = null
  }
}
