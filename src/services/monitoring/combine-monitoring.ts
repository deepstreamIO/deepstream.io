import { DeepstreamPlugin, DeepstreamMonitoring, SocketData, LOG_LEVEL, EVENT, MetaData } from '@deepstream/types'
import { Message } from '../../constants'

/**
 * The combine monitoring handler allows multiple monitoring plugins,
 * this allows to develop plugins that handle independantly multiple aspects of the monitoring: audit logs, user behaviour, more complex presence logic, etc
 * */
export class CombineMonitoring extends DeepstreamPlugin implements DeepstreamMonitoring {
  public description: string = ''

  constructor (private monitorings: DeepstreamMonitoring[]) {
    super()
    if (monitorings.length === 1) {
      this.description = monitorings[0].description
    } else {
      this.description = monitorings.map((monitoring, index) => `\n\t${index}) ${monitoring.description}`).join('')
    }
  }

  public async whenReady () {
    await Promise.all(this.monitorings.map((monitoring) => monitoring.whenReady()))
  }

  public async close () {
    await Promise.all(this.monitorings.map((monitoring) => monitoring.close()))
  }

  public init () {
    this.monitorings.forEach((monitoring) => monitoring.init ? monitoring.init() : null)
  }

  public onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string, metaData: MetaData): void {
    // NOTE: If using another logger service other than std-out or pino, the logger service must call this endpoint when logging.
    this.monitorings.forEach((monitoring) => monitoring.onErrorLog(loglevel, event, logMessage, metaData))
  }

  public onLogin (allowed: boolean, endpointType: string): void {
    this.monitorings.forEach((monitoring) => monitoring.onLogin(allowed, endpointType))
  }

  public onMessageReceived (message: Message, socketData: SocketData): void {
    this.monitorings.forEach((monitoring) => monitoring.onMessageReceived(message, socketData))
  }

  public onMessageSend (message: Message): void {
    this.monitorings.forEach((monitoring) => monitoring.onMessageSend(message))
  }

  public onBroadcast (message: Message, count: number): void {
    this.monitorings.forEach((monitoring) => monitoring.onBroadcast(message, count))
  }
}
