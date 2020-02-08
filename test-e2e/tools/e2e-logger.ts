import { DeepstreamLogger, DeepstreamPlugin, LOG_LEVEL, NamespacedLogger, EVENT } from '@deepstream/types'

interface Log {
  level: number,
  event: string,
  message: string
}

export class E2ELogger extends DeepstreamPlugin implements DeepstreamLogger {
  public description = 'Test Logger'
  public logs: Log[] = []
  public lastLog: Log | null = null

  public setLogLevel (logLevel: LOG_LEVEL): void {
    throw new Error('Method not implemented.')
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

  public fatal (event: EVENT, logMessage: string) {
    this.log(LOG_LEVEL.FATAL, event, logMessage)
  }

  public getNameSpace (namespace: string): NamespacedLogger {
    return {
      shouldLog: this.shouldLog.bind(this),
      fatal: this.fatal.bind(this),
      error: this.error.bind(this),
      warn: this.warn.bind(this),
      info: this.info.bind(this),
      debug: this.debug.bind(this),
    }
  }

  private log (logLevel: LOG_LEVEL, event: EVENT, logMessage: string) {
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
