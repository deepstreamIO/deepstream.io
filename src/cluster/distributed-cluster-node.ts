import { TOPIC, Message, StateMessage } from '../constants'
import { ClusterNode, StateRegistry, DeepstreamPlugin, DeepstreamServices, InternalDeepstreamConfig } from '../types'
import { DistributedStateRegistry } from './distributed-state-registry'

export default abstract class DistributedClusterNode extends DeepstreamPlugin implements ClusterNode {
  public stateRegistries = new Map<TOPIC, StateRegistry>()

  constructor (private pluginOptions: any, private services: DeepstreamServices, private config: InternalDeepstreamConfig) {
    super()
  }

  public abstract sendDirect (serverName: string, message: Message, metaData?: any): void

  public abstract sendState (message: StateMessage, metaData?: any): void

  public abstract sendStateDirect (serverName: string, message: StateMessage, metaData?: any): void

  public abstract send (message: Message, metaData?: any): void

  public abstract subscribe (stateRegistryTopic: TOPIC, callback: Function): void

  public abstract isLeader (): boolean

  public abstract getLeader (): string

  public getGlobalStateRegistry (): StateRegistry {
    return this.getStateRegistry(TOPIC.STATE_REGISTRY)
  }

  public getStateRegistry (topic: TOPIC): StateRegistry {
    let stateRegistry = this.stateRegistries.get(topic)
    if (!stateRegistry) {
      stateRegistry = new DistributedStateRegistry(topic, this.pluginOptions, this.services, this.config)
      this.stateRegistries.set(topic, stateRegistry)
    }
    return stateRegistry
  }

  public abstract async close (): Promise<void>
}
