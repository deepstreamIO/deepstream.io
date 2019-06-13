import { TOPIC, Message, StateMessage } from '../constants'
import { InternalDeepstreamConfig, DeepstreamServices, Cluster } from '../types'
import { StateRegistry } from './single-state-registry'
import { EventEmitter } from 'events';

export default class LocalClusterNode implements Cluster {
  public stateRegistries = new Map<TOPIC, StateRegistry>()
  private messageBus = new EventEmitter()

  constructor (private config: InternalDeepstreamConfig, services: DeepstreamServices, type: string) {
  }

  public sendState (message: StateMessage, metaData?: any) {
    this.send(message)
  }

  public sendStateDirect (serverName: string, message: StateMessage, metaData?: any) {
    this.sendDirect(serverName, message)
  }

  public sendDirect (serverName: string, message: Message, metaData?: any): void {
    setTimeout(() => {
        this.messageBus.emit(`${serverName}/${message.topic}`, message)
    }, 5)
  }

  public send (message: Message, metaData?: any) {
    setTimeout(() => {
      this.messageBus.emit(`ALL/${message.topic}`, message)
  }, 5)
  }

  public subscribe (topic: TOPIC, callback: (...args: any[]) => void) {
    this.messageBus.on(`${this.config.serverName}/${topic}`, callback)
    this.messageBus.on(`ALL/${topic}`, callback)
  }

  public getStateRegistry (stateRegistryTopic: TOPIC) {
    let stateRegistry = this.stateRegistries.get(stateRegistryTopic)
    if (!stateRegistry) {
      stateRegistry = new StateRegistry(stateRegistryTopic, this.config)
      this.stateRegistries.set(stateRegistryTopic, stateRegistry)
    }
    return stateRegistry
  }

  public close (callback: Function) {
    this.messageBus.removeAllListeners()
    callback()
  }
}
