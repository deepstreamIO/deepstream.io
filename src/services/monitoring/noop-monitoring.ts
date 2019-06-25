import { DeepstreamPlugin, Monitoring, LOG_LEVEL } from '../../types'
import { EVENT, Message } from '../../constants'

export class LocalMonitoring extends DeepstreamPlugin implements Monitoring {
  public description: string = 'noop monitoring'
  public apiVersion = 1

  public onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void {
  }

  public onLogin (allowed: boolean, endpointType: string): void {
    // console.log('onLogin', allowed, endpointType)
  }

  public onMessageRecieved (message: Message): void {
    // console.log('onMessageRecieved', message.topic, message.action, message.name)
  }

  public onMessageSend (message: Message): void {
    // console.log('onMessageSend', message.topic, message.action, message.name)
  }

  public onBroadcast (message: Message, count: number): void {
    // console.log('broadcasting', message.topic, message.action, message.name, count)
  }
}
