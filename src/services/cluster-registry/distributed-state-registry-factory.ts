import { DeepstreamPlugin, DeepstreamServices, DeepstreamConfig, StateRegistryFactory, StateRegistry } from '../../../ds-types/src/index'
import { TOPIC } from '../../constants'
import { DistributedStateRegistry, DistributedStateRegistryOptions } from '../cluster-state/distributed-state-registry'

export class DistributedStateRegistryFactory extends DeepstreamPlugin implements StateRegistryFactory {
    public description: string = 'Distributed State Registry'
    private stateRegistries = new Map<TOPIC, StateRegistry>()

    constructor (private pluginConfig: DistributedStateRegistryOptions, private services: DeepstreamServices, private config: DeepstreamConfig) {
        super()
    }

    public getStateRegistry = (topic: TOPIC) => {
      let stateRegistry = this.stateRegistries.get(topic)
      if (!stateRegistry) {
        stateRegistry = new DistributedStateRegistry(topic, this.pluginConfig, this.services, this.config)
        this.stateRegistries.set(topic, stateRegistry)
      }
      return stateRegistry
  }

  public getStateRegistries (): Map<TOPIC, StateRegistry> {
      return this.stateRegistries
  }
}
