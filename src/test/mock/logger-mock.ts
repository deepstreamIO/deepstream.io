import {spy, SinonSpy} from 'sinon'
import { Logger, DeepstreamPlugin, LOG_LEVEL } from '../../types'
import { EVENT } from '../../constants'

export default class LoggerMock extends DeepstreamPlugin implements Logger {
  public isReady: boolean
  public description: string = 'mock logger'
  public lastLogLevel: any
  public lastLogEvent: any
  public lastLogMessage: any
  public lastLogArguments: any
  public logSpy: SinonSpy

  constructor () {
    super()
    this.isReady = true
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

  public log (level: LOG_LEVEL, event: EVENT | string, message?: string, metaData?: any) {
    this.lastLogLevel = level
    this.lastLogEvent = event
    this.lastLogMessage = message
    this.lastLogArguments = Array.from(arguments)
  }

  public setLogLevel () {
  }
}
