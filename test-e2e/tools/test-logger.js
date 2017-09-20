'use strict'

const EventEmitter = require('events').EventEmitter
const util = require('util')

module.exports = class Logger extends EventEmitter{
  constructor () {
    super()
    this.logs = []
    this.lastLog = null
    this.isReady = true
  }

  error (event, logMessage) {
    this.log(3, event, logMessage)
  }

  warn (event, logMessage) {
    this.log(2, event, logMessage)
  }

  info (event, logMessage) {
     this.log(1, event, logMessage)
  }

  debug (event, logMessage) {
    this.log(0, event, logMessage)
  }

  log (logLevel, event, logMessage) {
    const log = {
      level: logLevel,
      event,
      message: logMessage
    }

    this.logs.push(log)
    this.lastLog = log

    switch (logLevel) {
      case 3:
        throw new Error(`Critical error occured on deepstream ${event} ${logMessage}`)
        break
      case 2:
        // console.log('Warning:', event, logMessage)
        break
    }
  }
}
