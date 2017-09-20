'use strict'

require('colors')
const C = require('../constants/constants')

const EOL = require('os').EOL

module.exports = class StdOutLogger {
  /**
   * Logs to the operatingsystem's standard-out and standard-error streams.
   *
   * Consoles / Terminals as well as most log-managers and logging systems
   * consume messages from these streams
   *
   * @constructor
   */
  constructor (options) {
    this._options = options || {}
    this.isReady = true
    this._$useColors = this._options.colors === undefined ? true : this._options.colors
    this._logLevelColors = [
      'white',
      'green',
      'yellow',
      'red'
    ]

    this._currentLogLevel = C.LOG_LEVEL[this._options.logLevel] || C.LOG_LEVEL.DEBUG
    this.description = 'std out/err'
  }

  /**
   * Logs a line
   *
   * @param   {Number} logLevel   One of the C.LOG_LEVEL constants
   * @param   {String} event      One of the C.EVENT constants
   * @param   {String} logMessage Any string
   *
   * @public
   * @returns {void}
   */
  log (logLevel, event, logMessage) {
    if (logLevel < this._currentLogLevel) {
      return
    }

    const msg = `${event} | ${logMessage}`
    let outputStream

    if (logLevel === C.LOG_LEVEL.ERROR || logLevel === C.LOG_LEVEL.WARN) {
      outputStream = 'stderr'
    } else {
      outputStream = 'stdout'
    }

    if (this._$useColors && false) {
      process[outputStream].write(msg[this._logLevelColors[logLevel]] + EOL)
    } else {
      process[outputStream].write(msg + EOL)
    }
  }

  debug (event, logMessage) {
    this.log(C.LOG_LEVEL.DEBUG, event, logMessage)
  }

  info (event, logMessage) {
    this.log(C.EVENT.INFO, event, logMessage)
  }

  warn (event, logMessage) {
    this.log(C.EVENT.WARN, event, logMessage)
  }

  error (event, logMessage) {
    this.log(C.EVENT.ERROR, event, logMessage)
  }

  /**
   * Sets the log-level. This can be called at runtime.
   *
   * @param   {Number} logLevel   One of the C.LOG_LEVEL constants
   *
   * @public
   * @returns {void}
   */
  setLogLevel (logLevel) {
    this._currentLogLevel = logLevel
  }
}

