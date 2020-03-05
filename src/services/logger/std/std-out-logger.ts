import * as chalk from 'chalk'
import { DeepstreamPlugin, DeepstreamLogger, DeepstreamServices, DeepstreamConfig, LOG_LEVEL, NamespacedLogger, EVENT, MetaData } from '@deepstream/types'
import { EOL } from 'os'

export class StdOutLogger extends DeepstreamPlugin implements DeepstreamLogger {
  public description = 'std out/err'

  private useColors: boolean
  private currentLogLevel!: LOG_LEVEL
  private logLevelColors: string[] = [
    'white',
    'green',
    'yellow',
    'red',
    'blue'
  ]

  /**
   * Logs to the operatingsystem's standard-out and standard-error streams.
   *
   * Consoles / Terminals as well as most log-managers and logging systems
   * consume messages from these streams
   */
  constructor (private options: any = {}, private services: DeepstreamServices, config: DeepstreamConfig) {
    super()
    this.useColors = this.options.colors === undefined ? true : this.options.colors
  }

  public async whenReady (): Promise<void> {
    this.description = `${this.description} at level ${LOG_LEVEL[this.currentLogLevel]}`
  }

  public shouldLog (logLevel: number): boolean {
    return this.currentLogLevel >= logLevel
  }

  public debug (event: EVENT, logMessage: string): void {
    this.log(LOG_LEVEL.DEBUG, '', event, logMessage)
  }

  public info (event: EVENT, logMessage: string): void {
    this.log(LOG_LEVEL.INFO, '', event, logMessage)
  }

  public warn (event: EVENT, logMessage: string, metaData?: MetaData): void {
    this.log(LOG_LEVEL.WARN, '', event, logMessage, metaData)
  }

  public error (event: EVENT, logMessage: string, metaData?: MetaData): void {
    this.log(LOG_LEVEL.ERROR, '', event, logMessage, metaData)
  }

  public fatal (event: EVENT, logMessage: string): void {
    this.log(LOG_LEVEL.FATAL, '', event, logMessage)
    this.services.notifyFatalException()
  }

  public getNameSpace (namespace: string): NamespacedLogger {
    return {
      shouldLog: this.shouldLog.bind(this),
      fatal: this.log.bind(this, LOG_LEVEL.FATAL, namespace),
      error: this.log.bind(this, LOG_LEVEL.ERROR, namespace),
      warn: this.log.bind(this, LOG_LEVEL.WARN, namespace),
      info: this.log.bind(this, LOG_LEVEL.INFO, namespace),
      debug: this.log.bind(this, LOG_LEVEL.DEBUG, namespace),
    }
  }

  /**
   * Sets the log-level. This can be called at runtime.
   */
  public setLogLevel (logLevel: LOG_LEVEL) {
    this.currentLogLevel = logLevel
  }

  /**
   * Logs a line
   */
  private log (logLevel: LOG_LEVEL, namespace: string, event: EVENT, logMessage: string, metaData: MetaData | null = null): void {
    if (logLevel >= LOG_LEVEL.WARN && this.services) {
      this.services.monitoring.onErrorLog(logLevel, event, logMessage, metaData!)
    }

    if (this.currentLogLevel > logLevel) {
      return
    }

    const msg = `${namespace ? `${namespace} | ` : '' }${event} | ${logMessage}`
    let outputStream

    if (logLevel === LOG_LEVEL.ERROR || logLevel === LOG_LEVEL.WARN) {
      outputStream = 'stderr'
    } else {
      outputStream = 'stdout'
    }

    if (this.useColors) {
      (process as any)[outputStream].write((chalk as any)[this.logLevelColors[logLevel]](msg) + EOL)
    } else {
      (process as any)[outputStream].write(msg + EOL)
    }

    if (logLevel === LOG_LEVEL.FATAL) {
      this.services.notifyFatalException()
    }
  }
}
