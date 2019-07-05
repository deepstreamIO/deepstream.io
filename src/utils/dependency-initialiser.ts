import { EVENT } from '../constants'
import { Deepstream } from '../deepstream.io'
import { DeepstreamConfig, DeepstreamServices, DeepstreamPlugin } from '../types'
import { EventEmitter } from 'events'

export class DependencyInitialiser {
  public isReady: boolean = false
  private timeout: NodeJS.Timeout | null = null
  private emitter = new EventEmitter()

/**
 * This class is used to track the initialisation of an individual service or plugin
 */
  constructor (private deepstream: Deepstream, private config: DeepstreamConfig, private services: DeepstreamServices, private dependency: DeepstreamPlugin, private name: string) {
    if (typeof this.dependency.whenReady !== 'function' || typeof this.dependency.isReady === 'undefined') {
      const errorMessage = `${this.name} needs to implement isReady and whenReady, please look at the DeepstreamPlugin API here` // TODO: Insert link
      this.services.logger.error(EVENT.PLUGIN_INITIALIZATION_ERROR, errorMessage)
      const error = (new Error(errorMessage)) as any
      error.code = 'PLUGIN_INITIALIZATION_ERROR'
      throw error
    }

    this.timeout = setTimeout(
      this.onTimeout.bind(this),
      this.config.dependencyInitialisationTimeout,
    )
    if (this.dependency.whenReady) {
      this.dependency.whenReady().then(this.onReady.bind(this))
    } else {
      this.services.logger.warn(EVENT.DEPRECATED, 'Plugins should now support the async whenReady API') // TODO: Link
      this.dependency.once('ready', this.onReady.bind(this))
    }
    this.dependency.on('error', this.onError.bind(this))

    if (this.dependency.init) {
      this.dependency.init()
    }
  }

  public async whenReady (): Promise<void> {
    if (!this.isReady) {
      return new Promise((resolve) => this.emitter.once('ready', resolve))
    }
  }

/**
 * Returns the underlying dependency (e.g. the Logger, StorageConnector etc.)
 */
  public getDependency (): DeepstreamPlugin {
    return this.dependency
  }

/**
 * Callback for succesfully initialised dependencies
 */
  private onReady (): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.dependency.description = this.dependency.description || (this.dependency as any).type
    const dependencyType = this.dependency.description ? `: ${this.dependency.description}` : ': no dependency description provided'
    this.services.logger.info(EVENT.INFO, `${this.name} ready${dependencyType}`)

    this.isReady = true
    this.emitter.emit('ready')
  }

/**
 * Callback for dependencies that weren't initialised in time
 */
  private onTimeout (): void {
    const message = `${this.name} wasn't initialised in time`
    this.logError(message)
    const error = (new Error(message)) as any
    error.code = EVENT.PLUGIN_INITIALIZATION_TIMEOUT
    throw error
  }

/**
* Handles errors emitted by the dependency at startup.
*
* Plugin errors that occur at runtime are handled by the deepstream.io main class
*/
  private onError (error: any): void {
    if (this.isReady !== true) {
      this.logError(`Error while initialising ${this.name}: ${error.toString()}`)
      this.deepstream.emit(EVENT.PLUGIN_INITIALIZATION_ERROR, error)
    }
  }

/**
 * Logs error messages
 *
 * Since the logger is a dependency in its own right, it can't be relied upon
 * here. If it is available, it will be used, otherwise the error will be logged
 * straight to the console
 */
  private logError (message: string): void {
    if (this.services.logger && this.services.logger.isReady) {
      this.services.logger.error(EVENT.PLUGIN_ERROR, message)
    } else {
      console.error('Error while initialising dependency')
      console.error(message)
    }
  }

}
