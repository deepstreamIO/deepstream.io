import {spy, SinonSpy} from 'sinon'
import { DeepstreamLogger, DeepstreamPlugin, LOG_LEVEL, NamespacedLogger, EVENT } from '@deepstream/types'

export default class LoggerMock extends DeepstreamPlugin implements DeepstreamLogger {
  public description: string = 'mock logger'
  public lastLogLevel: any
  public lastLogEvent: any
  public lastLogMessage: any
  public lastLogArguments: any
  public logSpy: SinonSpy

  constructor () {
    super()
    this.lastLogLevel = null
    this.lastLogEvent = null
    this.lastLogMessage = null
    this.lastLogArguments = null

    this.logSpy = spy()
  }

  public shouldLog (logLevel: LOG_LEVEL): boolean {
    return true
  }

  public warn (event: EVENT | string, message?: string, metaData?: any) {
    this.log(LOG_LEVEL.WARN, event, message)
    this.logSpy(LOG_LEVEL.WARN, event, message)
  }

  public debug (event: EVENT | string, message?: string, metaData?: any) {
    this.log(LOG_LEVEL.DEBUG, event, message)
    this.logSpy(LOG_LEVEL.DEBUG, event, message)
  }

  public info (event: EVENT | string, message?: string, metaData?: any) {
    this.log(LOG_LEVEL.INFO, event, message)
    this.logSpy(LOG_LEVEL.INFO, event, message)
  }

  public error (event: EVENT | string, message?: string, metaData?: any) {
    this.log(LOG_LEVEL.ERROR, event, message)
    this.logSpy(LOG_LEVEL.ERROR, event, message)
  }

  public fatal (event: string, message?: string | undefined, metaData?: any): void {
    this.log(LOG_LEVEL.FATAL, event, message)
    this.logSpy(LOG_LEVEL.FATAL, event, message)
  }

  public getNameSpace (namespace: string): NamespacedLogger {
    return this
  }

  private log (level: LOG_LEVEL, event: EVENT | string, message?: string, metaData?: any) {
    this.lastLogLevel = level
    this.lastLogEvent = event
    this.lastLogMessage = message
    this.lastLogArguments = Array.from(arguments)
  }

  public setLogLevel () {
  }
}
