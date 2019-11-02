import { DeepstreamConfig, DeepstreamServices, DeepstreamPlugin, EVENT } from '@deepstream/types'
import { EventEmitter } from 'events'

export class DependencyInitialiser {
  private isReady: boolean = false
  private timeout: NodeJS.Timeout | null = null
  private emitter = new EventEmitter()

/**
 * This class is used to track the initialization of an individual service or plugin
 */
  constructor (private config: DeepstreamConfig, private services: DeepstreamServices, private dependency: DeepstreamPlugin, private name: string) {
    if (typeof this.dependency.whenReady !== 'function') {
      const errorMessage = `${this.name} needs to implement async whenReady and close, please look at the DeepstreamPlugin API here` // TODO: Insert link
      this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, errorMessage)
      this.services.notifyFatalException()
      return
    }

    this.timeout = setTimeout(
      this.onTimeout.bind(this),
      this.config.dependencyInitializationTimeout,
    )

    if (this.dependency.init) {
      this.dependency.init()
    }

    this.dependency
      .whenReady()
      .then(this.onReady.bind(this))
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

    if (this.name === 'logger') {
      console.error('Error while initialising log dependency dependency')
      console.error(message)
      this.services.notifyFatalException()
    }

    this.services.logger.fatal(EVENT.PLUGIN_INITIALIZATION_TIMEOUT, message)
  }
}
