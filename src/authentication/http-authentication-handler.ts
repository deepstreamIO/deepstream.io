import HttpAuthenticationRequest from './http-authentication-request'
import { EventEmitter } from 'events'
import * as utils from '../utils/utils'

/**
 * @extends {EventEmitter}
 */
export default class HttpAuthenticationHandler extends EventEmitter implements AuthenticationHandler {
  public isReady: boolean
  public description: string
  private settings: any
  private logger: any

  /**
  * @param   {Object} settings
  * @param   {String} settings.endpointUrl http(s) endpoint that will receive post requests
  * @param   {Array}  settings.permittedStatusCodes an array of http status codes that qualify
  *                                                 as permitted
  * @param   {Number} settings.requestTimeout time in milliseconds before the request times out
  *                                           if no reply is received
  */
  constructor (settings: { endpointUrl: string, permittedStatusCodes: number[], requestTimeout: number }, logger: Logger) {
    super()
    this.isReady = true
    this.description = `http webhook to ${settings.endpointUrl}`
    this.settings = settings
    this.logger = logger
    this._validateSettings()
  }

  /**
  * Main interface. Authenticates incoming connections
  *
  * @param   {Object}   connectionData
  * @param   {Object}   authData
  * @param   {Function} callback
  *
  * @public
  * @implements {PermissionHandler.isValidUser}
  * @returns {void}
  */
  public isValidUser (connectionData, authData, callback): void {
    // tslint:disable-next-line
    new HttpAuthenticationRequest(
      { connectionData, authData },
      this.settings,
      this.logger,
      callback,
    )
  }

  /**
  * Validate the user provided settings
  */
  private _validateSettings (): void {
    utils.validateMap(this.settings, true, {
      endpointUrl: 'url',
      permittedStatusCodes: 'array',
      requestTimeout: 'number',
    })
  }
}
