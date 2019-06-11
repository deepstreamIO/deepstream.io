import { EventEmitter } from 'events'
import { EVENT, LOG_LEVEL } from '../../src/constants'

interface Log {
  level: number,
  event: string,
  message: string
}

export class Logger extends EventEmitter implements Logger {
  public logs: Log[]
  public lastLog: Log | null
  public isReady: boolean

  constructor () {
    super()
    this.logs = []
    this.lastLog = null
    this.isReady = true
  }

  public shouldLog () {
    return true
  }

  public error (event: EVENT, logMessage: string) {
    this.log(LOG_LEVEL.ERROR, event, logMessage)
  }

  public warn (event: EVENT, logMessage: string) {
    this.log(LOG_LEVEL.WARN, event, logMessage)
  }

  public info (event: EVENT, logMessage: string) {
     this.log(LOG_LEVEL.INFO, event, logMessage)
  }

  public debug (event: EVENT, logMessage: string) {
    this.log(LOG_LEVEL.DEBUG, event, logMessage)
  }

  public log (logLevel: LOG_LEVEL, event: EVENT, logMessage: string) {
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
