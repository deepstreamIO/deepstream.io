import { TOPIC, Message, StateMessage } from '../constants'
import { ClusterNode, StateRegistry, DeepstreamPlugin } from '../types'
import { SingleStateRegistry } from './single-state-registry'

export default class SingleClusterNode extends DeepstreamPlugin implements ClusterNode {
  public description = 'Single Cluster Node'
  public stateRegistries = new Map<TOPIC, SingleStateRegistry>()

  public sendDirect (serverName: string, message: Message, metaData?: any) {}

  public sendState (message: StateMessage, metaData?: any) {}

  public sendStateDirect (serverName: string, message: StateMessage, metaData?: any) {}

  public send (message: Message, metaData?: any) {}

  public subscribe (stateRegistryTopic: TOPIC, callback: Function) {}

  public isLeader (): boolean { throw new Error('Leader not used in single state') }

  public getLeader (): string { throw new Error('Leader not used in single state') }

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

  public async close (): Promise<void> {}
}
