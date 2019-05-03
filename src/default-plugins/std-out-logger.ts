import { EventEmitter } from 'events'
import { EVENT, LOG_LEVEL, TOPIC } from '../constants'

import chalk from 'chalk'

const EOL = require('os').EOL

export default class StdOutLogger extends EventEmitter implements Logger {
  public description: string
  public isReady: boolean

  private options: any
  private useColors: boolean
  private currentLogLevel: LOG_LEVEL
  private logLevelColors: string[]

  /**
   * Logs to the operatingsystem's standard-out and standard-error streams.
   *
   * Consoles / Terminals as well as most log-managers and logging systems
   * consume messages from these streams
   */
  constructor (options: any) {
    super()
    this.options = options || {}
    this.isReady = true
    this.useColors = this.options.colors === undefined ? true : this.options.colors
    this.logLevelColors = [
      'white',
      'green',
      'yellow',
      'red',
    ]

    this.currentLogLevel = this.options.logLevel || LOG_LEVEL.DEBUG
    this.description = 'std out/err'
  }

  public shouldLog (logLevel: number): boolean {
    return logLevel < this.currentLogLevel
  }

  /**
   * Logs a line
   */
  public log (logLevel: LOG_LEVEL, event: EVENT, logMessage: string): void {
    if (logLevel < this.currentLogLevel) {
      return
    }

    const msg = `${event} | ${logMessage}`
    let outputStream

    if (logLevel === LOG_LEVEL.ERROR || logLevel === LOG_LEVEL.WARN) {
      outputStream = 'stderr'
    } else {
      outputStream = 'stdout'
    }

    if (this.useColors) {
    process[outputStream].write(chalk[this.logLevelColors[logLevel]](msg) + EOL)
    } else {
    process[outputStream].write(msg + EOL)
    }
  }

  public debug (event: EVENT, logMessage: string): void {
    this.log(LOG_LEVEL.DEBUG, event, logMessage)
  }

  public info (event: EVENT, logMessage: string): void {
    this.log(LOG_LEVEL.INFO, event, logMessage)
  }

  public warn (event: EVENT, logMessage: string): void {
    this.log(LOG_LEVEL.WARN, event, logMessage)
  }

  public error (event: EVENT, logMessage: string): void {
    this.log(LOG_LEVEL.ERROR, event, logMessage)
  }

  /**
   * Sets the log-level. This can be called at runtime.
   */
  public setLogLevel (logLevel: LOG_LEVEL) {
    this.currentLogLevel = logLevel
  }
}
