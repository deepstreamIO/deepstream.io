import { EventEmitter } from 'events'

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

  public error (event, logMessage) {
    this.log(3, event, logMessage)
  }

  public warn (event, logMessage) {
    this.log(2, event, logMessage)
  }

  public info (event, logMessage) {
     this.log(1, event, logMessage)
  }

  public debug (event, logMessage) {
    this.log(0, event, logMessage)
  }

  public log (logLevel, event, logMessage) {
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
