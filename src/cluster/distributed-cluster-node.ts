import { TOPIC, Message } from '../constants'
import { ClusterNode, StateRegistry, DeepstreamPlugin, DeepstreamServices, DeepstreamConfig } from '../types'
import { DistributedStateRegistry } from './distributed-state-registry'

export default abstract class DistributedClusterNode extends DeepstreamPlugin implements ClusterNode {
  public stateRegistries = new Map<TOPIC, StateRegistry>()

  constructor (protected pluginOptions: any, protected services: DeepstreamServices, protected config: DeepstreamConfig) {
    super()
  }

  public abstract sendDirect (serverName: string, message: Message, metaData?: any): void

  public abstract send (message: Message, metaData?: any): void

  public abstract subscribe (stateRegistryTopic: TOPIC, callback: Function): void

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
