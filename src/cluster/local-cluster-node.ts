import { TOPIC, Message } from '../constants'
import { InternalDeepstreamConfig, DeepstreamServices, ClusterNode, StateRegistry, DeepstreamPlugin } from '../types'
import { EventEmitter } from 'events'
import { SingleStateRegistry } from './single-state-registry'

export default class LocalClusterNode extends DeepstreamPlugin implements ClusterNode {
  public isReady: boolean = true
  public description: string = 'No Clustering Enabled'
  public stateRegistries = new Map<TOPIC, StateRegistry>()
  private messageBus = new EventEmitter()

  constructor (pluginConfig: any, services: DeepstreamServices, private config: InternalDeepstreamConfig) {
    super()
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

  public getGlobalStateRegistry (): StateRegistry {
    return this.getStateRegistry(TOPIC.STATE_REGISTRY)
  }

  public getStateRegistry (stateRegistryTopic: TOPIC): StateRegistry {
    let stateRegistry = this.stateRegistries.get(stateRegistryTopic)
    if (!stateRegistry) {
      stateRegistry = new SingleStateRegistry()
      this.stateRegistries.set(stateRegistryTopic, stateRegistry)
    }
    return stateRegistry
  }

  public async close (): Promise<void> {
    this.messageBus.removeAllListeners()
  }
}
