import { DeepstreamPlugin, DeepstreamMonitoring, LOG_LEVEL, EVENT } from '@deepstream/types'
import { Message } from '../../constants'

export class NoopMonitoring extends DeepstreamPlugin implements DeepstreamMonitoring {
  public description: string = 'Noop Monitoring'

  public onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void {
  }

  public onLogin (allowed: boolean, endpointType: string): void {
  }

  public onMessageReceived (message: Message): void {
  }

  public onMessageSend (message: Message): void {
  }

  public onBroadcast (message: Message, count: number): void {
  }
}
