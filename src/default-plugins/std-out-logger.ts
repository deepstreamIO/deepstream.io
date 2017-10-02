import { EventEmitter } from 'events'

require('colors')
import { LOG_LEVEL } from '../constants'

const EOL = require('os').EOL

export default class StdOutLogger extends EventEmitter implements Plugin {
  private options: any
  public isReady: boolean
  public description: string
  private useColors: boolean
  private currentLogLevel: LOG_LEVEL
  private logLevelColors: Array<String>

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
      'red'
    ]

    this.currentLogLevel = this.options.logLevel || LOG_LEVEL.DEBUG
    this.description = 'std out/err'
  }

  /**
   * Logs a line
   */
  log (logLevel: LOG_LEVEL, event: string, logMessage: string): void {
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

    // if (this.useColors) {
    // process[outputStream].write(msg[this.logLevelColors[logLevel]] + EOL)
    // } else {
      process[outputStream].write(msg + EOL)
    // }
  }

  debug (event, logMessage): void {
    this.log(LOG_LEVEL.DEBUG, event, logMessage)
  }

  info (event, logMessage): void {
    this.log(LOG_LEVEL.INFO, event, logMessage)
  }

  warn (event, logMessage): void {
    this.log(LOG_LEVEL.WARN, event, logMessage)
  }

  error (event, logMessage): void {
    this.log(LOG_LEVEL.ERROR, event, logMessage)
  }

  /**
   * Sets the log-level. This can be called at runtime.
   */
  setLogLevel (logLevel: LOG_LEVEL) {
    this.currentLogLevel = logLevel
  }
}

