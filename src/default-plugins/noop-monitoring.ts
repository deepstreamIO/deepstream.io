import { EventEmitter } from 'events'
import { MonitoringPlugin } from '../types'
import { LOG_LEVEL, EVENT, Message } from '../constants'

export default class LocalMonitoring extends EventEmitter implements MonitoringPlugin {
  public description: string = 'noop monitoring'
  public isReady: boolean = true
  public apiVersion = 1

  constructor () {
    super()
  }

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
